/* ==========================================================================
   BARBEARIA OLD TOWN — INTERAÇÕES, HORÁRIOS, AGENDA E MOVIMENTO
   ========================================================================== */

(function () {
  'use strict';

  const WHATSAPP_PHONE = '5511999998888';

  const SERVICES = {
    corte: { name: 'Corte Tradicional', price: 50, duration: '40 min' },
    barba: { name: 'Barba com Toalha Quente', price: 40, duration: '35 min' },
    combo: { name: 'Combo Corte e Barba', price: 80, duration: '75 min' },
    sobrancelha: { name: 'Design de Sobrancelha', price: 20, duration: '15 min' },
    pigmentacao: { name: 'Pigmentação', price: 60, duration: '30 min' },
  };

  // Todos os horários possíveis de 09:00 a 19:30, pulando 12:00 e 12:30
  const ALL_TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30',
  ];

  const state = {
    barber: 'Sem preferência (primeiro disponível)',
    service: 'combo',
    date: '',
    time: '',
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.innerWidth >= 1100;

  // ========================================================================
  // 1. STATUS DA BARBEARIA EM TEMPO REAL + TABELA DE HORÁRIOS
  // ========================================================================
  function updateShopStatus() {
    const pill = document.getElementById('shopStatusPill');
    const textEl = document.getElementById('shopStatusText');
    const now = new Date();
    const day = now.getDay(); // 0 = Dom, 1 = Seg, 2..6 = Ter..Sáb
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;

    const isOpenDay = day >= 2 && day <= 6;
    const openMin = 9 * 60;
    const closeMin = 20 * 60;
    const isOpenNow = isOpenDay && currentMinutes >= openMin && currentMinutes < closeMin;

    let label = '';
    if (isOpenNow) {
      label = 'Aberto agora';
    } else if (isOpenDay && currentMinutes < openMin) {
      label = 'Fechado · abre às 9h';
    } else if (day === 0 || (day === 6 && currentMinutes >= closeMin)) {
      label = 'Fechado · abre terça às 9h';
    } else {
      label = 'Fechado, abre amanhã às 9h';
    }

    if (pill && textEl) {
      textEl.textContent = label;
      pill.classList.toggle('is-open', isOpenNow);
    }

    // Destaca o dia de hoje na tabela da ficha
    const todayRows = document.querySelectorAll('#hoursTable tr[data-day]');
    todayRows.forEach((row) => {
      const rowDay = parseInt(row.getAttribute('data-day'), 10);
      const isToday = rowDay === day;
      row.classList.toggle('is-today', isToday);
      const dayCell = row.querySelector('td:first-child');
      if (dayCell) {
        const existingBadge = dayCell.querySelector('.today-badge');
        if (isToday && !existingBadge) {
          const span = document.createElement('span');
          span.className = 'today-badge';
          span.textContent = 'HOJE';
          dayCell.appendChild(span);
        }
      }
    });
  }

  // ========================================================================
  // 2. HEADER AUTO-HIDE NO SCROLL & MENU MOBILE TELA CHEIA
  // ========================================================================
  function initHeaderBehavior() {
    const header = document.getElementById('siteHeader');
    const drawer = document.getElementById('mobileDrawer');
    const toggleBtn = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('menuCloseBtn');
    const mobileLinks = document.querySelectorAll('[data-mobile-close]');

    function setDrawer(open) {
      if (!drawer || !toggleBtn) return;
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      toggleBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open && closeBtn) {
        closeBtn.focus();
      } else if (!open) {
        toggleBtn.focus();
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => setDrawer(true));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => setDrawer(false));
    }
    mobileLinks.forEach((el) => {
      el.addEventListener('click', () => {
        if (drawer && drawer.classList.contains('is-open')) {
          setDrawer(false);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
        setDrawer(false);
      }
    });

    // Esconde ao rolar para baixo, reaparece ao rolar para cima
    let lastY = window.scrollY;
    window.addEventListener(
      'scroll',
      () => {
        if (!header) return;
        const currentY = window.scrollY;
        const drawerOpen = drawer && drawer.classList.contains('is-open');

        if (currentY <= 80 || drawerOpen) {
          header.classList.remove('is-hidden');
        } else if (currentY > lastY + 8) {
          header.classList.add('is-hidden');
        } else if (currentY < lastY - 8) {
          header.classList.remove('is-hidden');
        }
        lastY = currentY;
      },
      { passive: true }
    );

    // Link ativo por seção visível
    const sections = document.querySelectorAll('main section[id]');
    const navLinks = document.querySelectorAll('.header-nav a[href^="#"]');
    if ('IntersectionObserver' in window && sections.length && navLinks.length) {
      const navObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              navLinks.forEach((link) => {
                link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
              });
            }
          });
        },
        { rootMargin: '-35% 0px -55% 0px' }
      );
      sections.forEach((sec) => navObserver.observe(sec));
    }
  }

  // ========================================================================
  // 3. BARRA FIXA MOBILE (Esconde quando #agendamento está visível)
  // ========================================================================
  function initMobileStickyBar() {
    const stickyBar = document.getElementById('mobileStickyBar');
    const bookingEl = document.getElementById('agendamento');
    if (!stickyBar || !bookingEl || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          stickyBar.classList.toggle('is-hidden', entry.isIntersecting);
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(bookingEl);
  }

  // ========================================================================
  // 4. FORMULÁRIO INTELIGENTE DE AGENDAMENTO
  // ========================================================================
  function formatIsoDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function isOpenWeekday(dateStr) {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = d.getDay();
    return day >= 2 && day <= 6;
  }

  function getNextOpenDateStr() {
    const now = new Date();
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Se hoje já passou das 19:15 (último horário às 19:30), avança para amanhã
    if (currentMin >= 19 * 60 + 15) {
      candidate.setDate(candidate.getDate() + 1);
    }
    while (candidate.getDay() === 0 || candidate.getDay() === 1) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return formatIsoDate(candidate);
  }

  function maskPhone(val) {
    let digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length > 2) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 0) {
      return `(${digits}`;
    }
    return '';
  }

  function renderTimeSlots() {
    const container = document.getElementById('timeSlotsGrid');
    const slotMsg = document.getElementById('timeMsg');
    if (!container) return;

    container.innerHTML = '';
    if (slotMsg) {
      slotMsg.textContent = '';
      slotMsg.className = 'field-msg';
    }

    if (!state.date || !isOpenWeekday(state.date)) {
      state.time = '';
      if (slotMsg) {
        slotMsg.textContent = 'Escolha uma data de terça a sábado para liberar os horários.';
        slotMsg.classList.add('is-warning');
      }
      return;
    }

    const now = new Date();
    const todayStr = formatIsoDate(now);
    const isToday = state.date === todayStr;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const available = ALL_TIME_SLOTS.filter((slot) => {
      if (!isToday) return true;
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m > nowMinutes + 15;
    });

    if (available.length === 0) {
      state.time = '';
      if (slotMsg) {
        slotMsg.textContent = 'Os horários de hoje já encerraram. Selecione outra data na agenda.';
        slotMsg.classList.add('is-warning');
      }
      return;
    }

    if (!available.includes(state.time)) {
      state.time = '';
    }

    available.forEach((slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn' + (state.time === slot ? ' is-selected' : '');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(state.time === slot));
      btn.textContent = slot;
      btn.addEventListener('click', () => {
        state.time = slot;
        container.querySelectorAll('.slot-btn').forEach((b) => {
          const active = b.textContent === slot;
          b.classList.toggle('is-selected', active);
          b.setAttribute('aria-checked', String(active));
        });
        if (slotMsg) {
          slotMsg.textContent = '';
          slotMsg.className = 'field-msg';
        }
      });
      container.appendChild(btn);
    });
  }

  function updateEstimate() {
    const valEl = document.getElementById('estimateValue');
    const svc = SERVICES[state.service] || SERVICES.combo;
    if (valEl) {
      valEl.textContent = `R$ ${svc.price}`;
    }
  }

  function selectBarber(barberName) {
    state.barber = barberName;
    document.querySelectorAll('#barberChips .chip-btn').forEach((btn) => {
      const match = btn.getAttribute('data-barber') === barberName;
      btn.classList.toggle('is-selected', match);
      btn.setAttribute('aria-checked', String(match));
    });
  }

  function selectService(serviceKey) {
    if (!SERVICES[serviceKey]) return;
    state.service = serviceKey;
    document.querySelectorAll('#serviceChips .chip-btn').forEach((btn) => {
      const match = btn.getAttribute('data-service') === serviceKey;
      btn.classList.toggle('is-selected', match);
      btn.setAttribute('aria-checked', String(match));
    });
    updateEstimate();
  }

  function scrollToBooking() {
    const target = document.getElementById('agendamento');
    if (!target) return;
    if (window.__lenis && isDesktop() && !prefersReducedMotion) {
      window.__lenis.scrollTo(target, { offset: -80 });
    } else {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function initBookingForm() {
    const dateInput = document.getElementById('bookingDate');
    const dateMsg = document.getElementById('dateMsg');
    const phoneInput = document.getElementById('clientPhone');
    const nameInput = document.getElementById('clientName');
    const form = document.getElementById('bookingForm');

    // Inicializa data mínima e padrão válido (próximo dia aberto)
    if (dateInput) {
      const todayStr = formatIsoDate(new Date());
      const defaultDate = getNextOpenDateStr();
      dateInput.min = todayStr;
      dateInput.value = defaultDate;
      state.date = defaultDate;

      dateInput.addEventListener('change', () => {
        state.date = dateInput.value;
        if (!state.date) {
          dateMsg.textContent = 'Selecione uma data entre terça e sábado.';
          dateMsg.className = 'field-msg is-error';
          dateInput.classList.add('has-error');
        } else if (!isOpenWeekday(state.date)) {
          dateMsg.textContent = 'Domingo e segunda estamos fechados. Escolha uma data de terça a sábado.';
          dateMsg.className = 'field-msg is-warning';
          dateInput.classList.add('has-error');
        } else {
          dateMsg.textContent = 'Barbearia aberta neste dia (09h às 20h).';
          dateMsg.className = 'field-msg is-ok';
          dateInput.classList.remove('has-error');
        }
        renderTimeSlots();
      });
    }

    // Chips de barbeiro
    document.querySelectorAll('#barberChips .chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectBarber(btn.getAttribute('data-barber'));
      });
    });

    // Chips de serviço
    document.querySelectorAll('#serviceChips .chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectService(btn.getAttribute('data-service'));
      });
    });

    // Botões rápidos no cardápio e na equipe
    document.querySelectorAll('[data-pick-service]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectService(btn.getAttribute('data-pick-service'));
        scrollToBooking();
      });
    });

    document.querySelectorAll('[data-pick-barber]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectBarber(btn.getAttribute('data-pick-barber'));
        scrollToBooking();
      });
    });

    // Máscara de telefone
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = maskPhone(phoneInput.value);
        const err = document.getElementById('phoneMsg');
        if (err && phoneInput.value.replace(/\D/g, '').length >= 10) {
          err.textContent = '';
          err.className = 'field-msg';
          phoneInput.classList.remove('has-error');
        }
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const err = document.getElementById('nameMsg');
        if (err && nameInput.value.trim().length >= 2) {
          err.textContent = '';
          err.className = 'field-msg';
          nameInput.classList.remove('has-error');
        }
      });
    }

    renderTimeSlots();
    updateEstimate();

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameMsg = document.getElementById('nameMsg');
        const phoneMsg = document.getElementById('phoneMsg');
        const timeMsg = document.getElementById('timeMsg');
        const notesInput = document.getElementById('clientNotes');
        const confirmBox = document.getElementById('bookingConfirmation');
        const confirmSummary = document.getElementById('confirmationSummary');
        const confirmLink = document.getElementById('confirmationWaLink');

        let hasError = false;
        const nameVal = nameInput ? nameInput.value.trim() : '';
        const phoneVal = phoneInput ? phoneInput.value.trim() : '';
        const phoneDigits = phoneVal.replace(/\D/g, '');
        const notesVal = notesInput ? notesInput.value.trim() : '';

        if (nameVal.length < 2) {
          hasError = true;
          if (nameMsg) {
            nameMsg.textContent = 'Informe seu nome para reservar a cadeira.';
            nameMsg.className = 'field-msg is-error';
          }
          if (nameInput) nameInput.classList.add('has-error');
        }

        if (phoneDigits.length < 10) {
          hasError = true;
          if (phoneMsg) {
            phoneMsg.textContent = 'Informe um WhatsApp válido com DDD.';
            phoneMsg.className = 'field-msg is-error';
          }
          if (phoneInput) phoneInput.classList.add('has-error');
        }

        if (!state.date || !isOpenWeekday(state.date)) {
          hasError = true;
          if (dateMsg) {
            dateMsg.textContent = 'Escolha uma data válida de terça a sábado.';
            dateMsg.className = 'field-msg is-error';
          }
          if (dateInput) dateInput.classList.add('has-error');
        }

        if (!state.time) {
          hasError = true;
          if (timeMsg) {
            timeMsg.textContent = 'Selecione um dos horários disponíveis acima.';
            timeMsg.className = 'field-msg is-error';
          }
        }

        if (hasError) {
          const firstError = form.querySelector('.has-error, .is-error');
          if (firstError && typeof firstError.focus === 'function') {
            firstError.focus();
          }
          return;
        }

        const svc = SERVICES[state.service] || SERVICES.combo;
        const formattedDate = formatDateBR(state.date);

        const messageLines = [
          '*AGENDAMENTO - BARBEARIA OLD TOWN*',
          '',
          `*Cliente:* ${nameVal}`,
          `*WhatsApp:* ${phoneVal}`,
          `*Barbeiro:* ${state.barber}`,
          `*Serviço:* ${svc.name}`,
          `*Data:* ${formattedDate}`,
          `*Horário:* ${state.time}`,
          notesVal ? `*Observações:* ${notesVal}` : null,
          `*Valor estimado:* R$ ${svc.price}`,
          '',
          'Olá! Gostaria de confirmar este horário na Rua Tuiuti, 55.',
        ].filter(Boolean);

        const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(messageLines.join('\n'))}`;

        if (confirmBox && confirmSummary && confirmLink) {
          confirmSummary.textContent = `${svc.name} com ${state.barber} em ${formattedDate} às ${state.time} (estimado: R$ ${svc.price}).`;
          confirmLink.href = waUrl;
          confirmBox.hidden = false;
          confirmLink.focus();
        }
      });
    }
  }

  // ========================================================================
  // 5. GALERIA DE ESTRUTURA (Mobile counter fallback + Desktop GSAP Pin)
  // ========================================================================
  function initGalleryFallbackCounter() {
    const viewport = document.getElementById('galleryViewport');
    const counterNum = document.getElementById('galleryCurrent');
    const slides = document.querySelectorAll('.gallery-slide');
    if (!viewport || !counterNum || !slides.length) return;

    let rafId = null;
    viewport.addEventListener(
      'scroll',
      () => {
        if (isDesktop() && !prefersReducedMotion) return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const vpRect = viewport.getBoundingClientRect();
          const vpCenter = vpRect.left + vpRect.width / 2;
          let closest = 1;
          let minDist = Infinity;
          slides.forEach((slide, idx) => {
            const rect = slide.getBoundingClientRect();
            const dist = Math.abs(vpCenter - (rect.left + rect.width / 2));
            if (dist < minDist) {
              minDist = dist;
              closest = idx + 1;
            }
          });
          counterNum.textContent = String(closest).padStart(2, '0');
        });
      },
      { passive: true }
    );
  }

  // ========================================================================
  // 6. MOVIMENTO: LENIS (Desktop) + GSAP SCROLLTRIGGER + MAGNETIC BUTTONS
  // ========================================================================
  function initMotion() {
    const progressBar = document.getElementById('readingProgress');

    // Barra de progresso leve mesmo sem GSAP
    function updateNativeProgress() {
      if (!progressBar) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      progressBar.style.transform = `scaleX(${ratio})`;
    }
    window.addEventListener('scroll', updateNativeProgress, { passive: true });
    updateNativeProgress();

    if (prefersReducedMotion || typeof window.gsap === 'undefined') {
      return;
    }

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Lenis suave somente no desktop
    if (isDesktop() && typeof window.Lenis !== 'undefined') {
      const lenis = new window.Lenis({
        duration: 1.05,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      window.__lenis = lenis;
      if (ScrollTrigger) {
        lenis.on('scroll', ScrollTrigger.update);
      }
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    // Parallax leve no hero (máximo 8%)
    const heroMedia = document.querySelector('.hero-media');
    if (heroMedia && ScrollTrigger) {
      gsap.to(heroMedia, {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: '#inicio',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    // Selo circular girando ao rolar
    const stampSvg = document.querySelector('.rotating-stamp svg');
    if (stampSvg && ScrollTrigger) {
      gsap.to(stampSvg, {
        rotation: 220,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
        },
      });
    }

    // Contador animado de avaliações (+1.200)
    const counterEl = document.getElementById('reviewsCounter');
    if (counterEl && ScrollTrigger) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: 1200,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: counterEl,
          start: 'top 95%',
          once: true,
        },
        onUpdate: () => {
          counterEl.textContent = Math.round(obj.val).toLocaleString('pt-BR');
        },
      });
    }

    // Revelação linha a linha nos títulos com máscara
    document.querySelectorAll('[data-split]').forEach((titleEl) => {
      const lines = titleEl.querySelectorAll('.split-line-inner');
      if (!lines.length || !ScrollTrigger) return;
      gsap.from(lines, {
        yPercent: 105,
        duration: 0.75,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: titleEl,
          start: 'top 86%',
          once: true,
        },
      });
    });

    // Marquee contínuo reativo à velocidade do scroll
    const marqueeTrack = document.getElementById('marqueeTrack');
    if (marqueeTrack) {
      const marqueeAnim = gsap.to(marqueeTrack, {
        xPercent: -50,
        duration: 28,
        ease: 'none',
        repeat: -1,
      });

      if (ScrollTrigger) {
        let resetTimer = null;
        ScrollTrigger.create({
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const vel = self.getVelocity();
            const boost = Math.min(3.2, 1 + Math.abs(vel) / 900);
            const skew = Math.max(-3.5, Math.min(3.5, vel / -350));
            marqueeAnim.timeScale(vel < 0 ? -boost : boost);
            gsap.to(marqueeTrack, { skewX: skew, duration: 0.25, overwrite: 'auto' });
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
              gsap.to(marqueeAnim, { timeScale: 1, duration: 0.6 });
              gsap.to(marqueeTrack, { skewX: 0, duration: 0.45 });
            }, 140);
          },
        });
      }
    }

    // Galeria horizontal pinned no desktop
    const galleryPin = document.getElementById('galleryPin');
    const galleryTrack = document.getElementById('galleryTrack');
    const galleryCounter = document.getElementById('galleryCurrent');
    if (galleryPin && galleryTrack && ScrollTrigger && isDesktop()) {
      const slides = galleryTrack.querySelectorAll('.gallery-slide');
      const getScrollDist = () => Math.max(0, galleryTrack.scrollWidth - window.innerWidth + 48);

      gsap.to(galleryTrack, {
        x: () => -getScrollDist(),
        ease: 'none',
        scrollTrigger: {
          trigger: galleryPin,
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
          end: () => `+=${getScrollDist()}`,
          onUpdate: (self) => {
            if (galleryCounter && slides.length) {
              const idx = Math.min(
                slides.length,
                Math.max(1, Math.round(self.progress * (slides.length - 1)) + 1)
              );
              galleryCounter.textContent = String(idx).padStart(2, '0');
            }
          },
        },
      });
    }

    // Linha tracejada dos passos se desenhando no scroll
    const stepLine = document.getElementById('stepsConnectorPath');
    if (stepLine && ScrollTrigger && isDesktop()) {
      const length = stepLine.getTotalLength();
      stepLine.style.strokeDasharray = `8 8`;
      gsap.fromTo(
        stepLine,
        { strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#como-funciona',
            start: 'top 72%',
            once: true,
          },
        }
      );
    }

    // Efeito magnético sutil nos botões primários (somente desktop)
    if (isDesktop()) {
      document.querySelectorAll('.btn-magnetic').forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
          const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.16;
          gsap.to(btn, { x: dx, y: dy, duration: 0.25, ease: 'power2.out' });
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
        });
      });
    }
  }

  // Fallback de imagens externas para assets locais caso necessário
  function initImageFallbacks() {
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const fb = img.getAttribute('data-fallback');
        if (fb && img.getAttribute('src') !== fb) {
          img.setAttribute('src', fb);
        }
      });
    });
  }

  // Inicialização Geral
  document.addEventListener('DOMContentLoaded', () => {
    updateShopStatus();
    setInterval(updateShopStatus, 60000);
    initHeaderBehavior();
    initMobileStickyBar();
    initBookingForm();
    initGalleryFallbackCounter();
    initImageFallbacks();
    initMotion();
  });
})();
