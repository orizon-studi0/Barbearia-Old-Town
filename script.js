/* ==========================================================================
   BARBEARIA OLD TOWN — INTERAÇÕES E CARROSSÉIS
   100% JavaScript puro, sem dependências externas.
   ========================================================================== */

(function () {
  'use strict';

  const AUTO_INTERVAL_MS = 4000;
  const DRAG_THRESHOLD_PX = 6;
  const FLICK_BIAS_PX = 36;
  const DESKTOP_GRID_BREAKPOINT = '(min-width: 1024px)';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ========================================================================
  // 1. STATUS AO VIVO & DESTAQUE DO DIA NA FICHA
  // ========================================================================
  function updateShopStatus() {
    const pill = document.getElementById('shopStatusPill');
    const textEl = document.getElementById('shopStatusText');
    const now = new Date();
    const day = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const isOpenDay = day >= 2 && day <= 6;
    const openMin = 9 * 60;
    const closeMin = 20 * 60;
    const isOpenNow = isOpenDay && currentMinutes >= openMin && currentMinutes < closeMin;

    let label = '';
    if (isOpenNow) {
      label = 'Aberto agora';
    } else if (isOpenDay && currentMinutes < openMin) {
      label = 'Fechado, abre hoje às 9h';
    } else if (day === 0 || (day === 6 && currentMinutes >= closeMin)) {
      label = 'Fechado, abre terça às 9h';
    } else {
      label = 'Fechado, abre amanhã às 9h';
    }

    if (pill && textEl) {
      textEl.textContent = label;
      pill.classList.toggle('is-open', isOpenNow);
    }

    document.querySelectorAll('#hoursTable tr[data-day]').forEach((row) => {
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
  // 2. HEADER TRANSPARENTE NO TOPO -> CARVÃO AO ROLAR + MENU MOBILE
  // ========================================================================
  function initHeaderBehavior() {
    const header = document.getElementById('siteHeader');
    const drawer = document.getElementById('mobileDrawer');
    const toggleBtn = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('menuCloseBtn');
    const mobileLinks = document.querySelectorAll('[data-mobile-close]');

    function syncHeaderScroll() {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    }

    window.addEventListener('scroll', syncHeaderScroll, { passive: true });
    syncHeaderScroll();

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

    if (toggleBtn) toggleBtn.addEventListener('click', () => setDrawer(true));
    if (closeBtn) closeBtn.addEventListener('click', () => setDrawer(false));

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
  // 3. CARROSSEL INTERATIVO COM DESTAQUE CENTRAL
  //    - Cronômetro de 4s passando página por página enquanto visível na tela
  //    - Ao sair do carrossel: pausa preservando o slide atual
  //    - Ao voltar ao carrossel: começa a contar 4s novamente desse slide
  //    - Desktop: clique vai para o card/lado, segurar + arrastar move o carrossel
  //    - Mobile: arraste fluido no dedo + toque em cards laterais
  //    - Em desktop (>= 1024px), data-desktop-grid="3" exibe 3 colunas lado a lado
  // ========================================================================
  function initCenterCarousels() {
    const carousels = document.querySelectorAll('[data-carousel]');
    if (!carousels.length) return;

    const desktopGridMQ = window.matchMedia(DESKTOP_GRID_BREAKPOINT);

    carousels.forEach((carousel) => {
      const name = carousel.getAttribute('data-carousel') || '';
      const hasDesktopGrid = carousel.getAttribute('data-desktop-grid') === '3';
      const initialIdx = parseInt(carousel.getAttribute('data-initial-slide') || '0', 10);
      const track = carousel.querySelector('.cc-track');
      const slides = Array.from(carousel.querySelectorAll('.cc-slide'));
      const dotsWrap = carousel.querySelector('.cc-dots');
      const prevBtn = carousel.querySelector('.cc-prev');
      const nextBtn = carousel.querySelector('.cc-next');

      if (!track || !slides.length) return;

      let activeIdx = Math.max(0, Math.min(slides.length - 1, initialIdx));
      let autoInterval = null;
      let scrollSettleTimer = null;
      let isInViewport = false;
      let isDraggingMouse = false;
      let isTouching = false;
      let dragStartX = 0;
      let dragStartScrollLeft = 0;
      let dragMaxDelta = 0;
      let suppressNextClick = false;
      let ignoreScrollSyncUntil = 0;
      let dots = [];

      const isGridMode = () => hasDesktopGrid && desktopGridMQ.matches;

      if (dotsWrap) {
        dotsWrap.innerHTML = '';
        dots = slides.map((_, idx) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'cc-dot' + (idx === activeIdx ? ' is-active' : '');
          dot.setAttribute('aria-label', `Ir para item ${idx + 1} de ${slides.length}`);
          dot.setAttribute('aria-current', idx === activeIdx ? 'true' : 'false');
          dot.addEventListener('click', () => {
            goToSlide(idx, true);
            startAuto();
          });
          dotsWrap.appendChild(dot);
          return dot;
        });
      }

      function syncGalleryHeader(idx) {
        if (name !== 'estrutura') return;
        const currentEl = document.getElementById('galleryCurrent');
        const titleEl = document.getElementById('galleryFocusTitle');
        if (currentEl) {
          currentEl.textContent = String(idx + 1).padStart(2, '0');
        }
        if (titleEl && slides[idx]) {
          titleEl.textContent = slides[idx].getAttribute('data-slide-title') || '';
        }
      }

      function setActiveSlide(idx) {
        if (idx < 0 || idx >= slides.length) return;
        activeIdx = idx;
        slides.forEach((slide, i) => {
          slide.classList.toggle('is-active', i === activeIdx);
        });
        dots.forEach((dot, i) => {
          const active = i === activeIdx;
          dot.classList.toggle('is-active', active);
          dot.setAttribute('aria-current', active ? 'true' : 'false');
        });
        syncGalleryHeader(activeIdx);
      }

      function getClosestSlideIdx() {
        const trackCenter = track.scrollLeft + track.clientWidth / 2;
        let closestIdx = activeIdx;
        let minDistance = Infinity;

        slides.forEach((slide, idx) => {
          const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
          const dist = Math.abs(slideCenter - trackCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        return closestIdx;
      }

      function scrollTrackToSlide(idx, smooth) {
        if (isGridMode()) return;
        const slide = slides[idx];
        if (!slide) return;
        const targetLeft = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;
        ignoreScrollSyncUntil = Date.now() + (smooth && !prefersReducedMotion ? 650 : 120);
        track.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto',
        });
      }

      function goToSlide(idx, smooth) {
        if (isGridMode()) return;
        const wrapped = ((idx % slides.length) + slides.length) % slides.length;
        setActiveSlide(wrapped);
        scrollTrackToSlide(wrapped, smooth);
      }

      setActiveSlide(activeIdx);
      requestAnimationFrame(() => {
        scrollTrackToSlide(activeIdx, false);
      });

      function stopAuto() {
        if (autoInterval) {
          clearInterval(autoInterval);
          autoInterval = null;
        }
      }

      function startAuto() {
        stopAuto();
        if (
          isGridMode() ||
          prefersReducedMotion ||
          isDraggingMouse ||
          isTouching ||
          !isInViewport ||
          document.hidden
        ) {
          return;
        }
        autoInterval = setInterval(() => {
          goToSlide(activeIdx + 1, true);
        }, AUTO_INTERVAL_MS);
      }

      // Sincroniza o slide ativo quando o usuário rola manualmente (touch ou trackpad)
      track.addEventListener(
        'scroll',
        () => {
          if (isGridMode()) return;
          if (isDraggingMouse) {
            setActiveSlide(getClosestSlideIdx());
            return;
          }
          if (Date.now() < ignoreScrollSyncUntil) return;

          if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
          scrollSettleTimer = setTimeout(() => {
            if (isDraggingMouse || isTouching || isGridMode()) return;
            const closest = getClosestSlideIdx();
            if (closest !== activeIdx) {
              setActiveSlide(closest);
              startAuto();
            }
          }, 90);
        },
        { passive: true }
      );

      // Mobile / Touch: pausa durante o toque e reinicia contagem de 4s ao soltar
      track.addEventListener(
        'touchstart',
        () => {
          if (isGridMode()) return;
          isTouching = true;
          stopAuto();
        },
        { passive: true }
      );

      track.addEventListener(
        'touchend',
        () => {
          if (isGridMode()) return;
          isTouching = false;
          if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
          scrollSettleTimer = setTimeout(() => {
            const closest = getClosestSlideIdx();
            setActiveSlide(closest);
            startAuto();
          }, 160);
        },
        { passive: true }
      );

      track.addEventListener(
        'touchcancel',
        () => {
          isTouching = false;
          startAuto();
        },
        { passive: true }
      );

      // Evita arraste fantasma nativo de imagens/links durante o clique-e-arraste com o mouse
      track.addEventListener('dragstart', (e) => {
        if (!isGridMode()) {
          e.preventDefault();
        }
      });

      // Mouse Desktop: segurar e arrastar para o lado
      track.addEventListener('mousedown', (e) => {
        if (isGridMode() || e.button !== 0) return;
        isDraggingMouse = true;
        dragStartX = e.clientX;
        dragStartScrollLeft = track.scrollLeft;
        dragMaxDelta = 0;
        suppressNextClick = false;
        stopAuto();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDraggingMouse) return;
        const deltaX = e.clientX - dragStartX;
        dragMaxDelta = Math.max(dragMaxDelta, Math.abs(deltaX));

        if (dragMaxDelta > DRAG_THRESHOLD_PX) {
          if (!track.classList.contains('is-dragging')) {
            track.classList.add('is-dragging');
          }
          track.scrollLeft = dragStartScrollLeft - deltaX;
        }
      });

      function finishMouseDrag(e) {
        if (!isDraggingMouse) return;
        const movedPastThreshold = dragMaxDelta > DRAG_THRESHOLD_PX;
        const finalDeltaX = e && typeof e.clientX === 'number' ? e.clientX - dragStartX : 0;

        isDraggingMouse = false;
        track.classList.remove('is-dragging');

        if (movedPastThreshold) {
          suppressNextClick = true;
          setTimeout(() => {
            suppressNextClick = false;
          }, 80);

          let targetIdx = getClosestSlideIdx();
          if (targetIdx === activeIdx && Math.abs(finalDeltaX) >= FLICK_BIAS_PX) {
            targetIdx = finalDeltaX < 0
              ? Math.min(slides.length - 1, activeIdx + 1)
              : Math.max(0, activeIdx - 1);
          }

          goToSlide(targetIdx, true);
          startAuto();
        } else {
          startAuto();
        }
      }

      window.addEventListener('mouseup', finishMouseDrag);
      window.addEventListener('blur', finishMouseDrag);

      // Clique com o mouse:
      // - Se veio de um arraste, cancela o clique acidental em links/botões
      // - Se clicou em um card lateral, centraliza esse card
      // - Se clicou no card ativo (fora de um botão/link como "Agendar"), vai para o card ao lado
      track.addEventListener('click', (e) => {
        if (isGridMode()) return;

        if (suppressNextClick) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const clickedSlide = e.target.closest('.cc-slide');
        const clickedInteractive = e.target.closest('a, button');

        if (clickedSlide) {
          const idx = slides.indexOf(clickedSlide);
          if (idx === -1) return;

          if (idx !== activeIdx) {
            e.preventDefault();
            goToSlide(idx, true);
            startAuto();
            return;
          }

          // Card central ativo: mantém links/botões ("Agendar") funcionando normalmente
          if (clickedInteractive) {
            return;
          }

          // Clique em qualquer área do card ativo avança para o lado
          const rect = track.getBoundingClientRect();
          const clickRatio = (e.clientX - rect.left) / rect.width;
          if (clickRatio < 0.3 && activeIdx > 0) {
            goToSlide(activeIdx - 1, true);
          } else {
            goToSlide(activeIdx + 1, true);
          }
          startAuto();
          return;
        }

        // Clique no espaço vazio da trilha
        if (!clickedInteractive) {
          const rect = track.getBoundingClientRect();
          const isLeftHalf = e.clientX < rect.left + rect.width / 2;
          goToSlide(isLeftHalf ? activeIdx - 1 : activeIdx + 1, true);
          startAuto();
        }
      });

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          goToSlide(activeIdx - 1, true);
          startAuto();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          goToSlide(activeIdx + 1, true);
          startAuto();
        });
      }

      carousel.addEventListener('keydown', (e) => {
        if (isGridMode()) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToSlide(activeIdx + 1, true);
          startAuto();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToSlide(activeIdx - 1, true);
          startAuto();
        } else if (e.key === 'Home') {
          e.preventDefault();
          goToSlide(0, true);
          startAuto();
        } else if (e.key === 'End') {
          e.preventDefault();
          goToSlide(slides.length - 1, true);
          startAuto();
        }
      });

      if (hasDesktopGrid) {
        const handleBreakpointChange = () => {
          if (isGridMode()) {
            isDraggingMouse = false;
            track.classList.remove('is-dragging');
            stopAuto();
          } else {
            requestAnimationFrame(() => {
              scrollTrackToSlide(activeIdx, false);
            });
            startAuto();
          }
        };
        if (typeof desktopGridMQ.addEventListener === 'function') {
          desktopGridMQ.addEventListener('change', handleBreakpointChange);
        }
      }

      if ('IntersectionObserver' in window) {
        const visObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              isInViewport = entry.isIntersecting;
              if (isInViewport) {
                startAuto();
              } else {
                stopAuto();
              }
            });
          },
          { threshold: 0.25 }
        );
        visObserver.observe(carousel);
      } else {
        isInViewport = true;
        startAuto();
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopAuto();
        } else {
          startAuto();
        }
      });
    });
  }

  // ========================================================================
  // 4. REVELAÇÃO LEVE AO ROLAR (1 vez só, via IntersectionObserver)
  // ========================================================================
  function initScrollReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    els.forEach((el) => observer.observe(el));
  }

  // ========================================================================
  // 5. PLANO B DE IMAGENS (Zero ícone quebrado)
  // ========================================================================
  function initImageFallbacks() {
    document.querySelectorAll('[data-fallback-container]').forEach((container) => {
      const img = container.querySelector('img');
      const fallback = container.querySelector('.img-fallback-block');
      const pic = container.querySelector('picture');
      if (!img || !fallback) return;

      const activateFallback = () => {
        if (pic) pic.hidden = true;
        img.hidden = true;
        fallback.hidden = false;
        fallback.removeAttribute('aria-hidden');
      };

      img.addEventListener('error', activateFallback);
      if (img.complete && img.naturalWidth === 0) {
        activateFallback();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateShopStatus();
    setInterval(updateShopStatus, 60000);
    initHeaderBehavior();
    initCenterCarousels();
    initScrollReveal();
    initImageFallbacks();
  });
})();
