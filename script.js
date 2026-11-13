/* ==========================================================================
   BARBEARIA OLD TOWN — INTERAÇÕES E CARROSSÉIS
   100% JavaScript puro, sem dependências externas.
   ========================================================================== */

(function () {
  'use strict';

  const AUTO_INTERVAL_MS = 4000;
  const RESUME_AFTER_INTERACTION_MS = 6000;
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
  // 3. CARROSSEL COM DESTAQUE CENTRAL
  //    - Sem botão de pause manual
  //    - Avança a cada 4s somente quando visível na tela
  //    - Ao sair da viewport, pausa mantendo o slide atual; ao voltar, retoma 4s dele
  //    - Em desktop (>= 1024px), carrosséis com data-desktop-grid="3" ficam lado a lado
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
      let resumeTimeout = null;
      let isHoverOrFocus = false;
      let isInViewport = false;
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
            pauseTemporarily();
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

      function scrollTrackToSlide(idx, smooth) {
        if (isGridMode()) return;
        const slide = slides[idx];
        if (!slide) return;
        const targetLeft = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;
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

      if ('IntersectionObserver' in window) {
        const slideObserver = new IntersectionObserver(
          (entries) => {
            if (isGridMode()) return;
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const idx = slides.indexOf(entry.target);
                if (idx !== -1) {
                  setActiveSlide(idx);
                }
              }
            });
          },
          {
            root: track,
            rootMargin: '0px -40% 0px -40%',
            threshold: 0.05,
          }
        );
        slides.forEach((slide) => slideObserver.observe(slide));
      }

      function clearPendingResume() {
        if (resumeTimeout) {
          clearTimeout(resumeTimeout);
          resumeTimeout = null;
        }
      }

      function stopAuto() {
        if (autoInterval) {
          clearInterval(autoInterval);
          autoInterval = null;
        }
      }

      function startAuto() {
        stopAuto();
        clearPendingResume();
        if (
          isGridMode() ||
          prefersReducedMotion ||
          isHoverOrFocus ||
          !isInViewport ||
          document.hidden
        ) {
          return;
        }
        autoInterval = setInterval(() => {
          goToSlide(activeIdx + 1, true);
        }, AUTO_INTERVAL_MS);
      }

      function pauseTemporarily() {
        stopAuto();
        clearPendingResume();
        if (!prefersReducedMotion && !isGridMode() && isInViewport && !document.hidden) {
          resumeTimeout = setTimeout(() => {
            startAuto();
          }, RESUME_AFTER_INTERACTION_MS);
        }
      }

      track.addEventListener('touchstart', pauseTemporarily, { passive: true });
      track.addEventListener('pointerdown', pauseTemporarily, { passive: true });
      track.addEventListener('wheel', pauseTemporarily, { passive: true });

      carousel.addEventListener('mouseenter', () => {
        isHoverOrFocus = true;
        stopAuto();
        clearPendingResume();
      });
      carousel.addEventListener('mouseleave', () => {
        isHoverOrFocus = false;
        startAuto();
      });
      carousel.addEventListener('focusin', () => {
        isHoverOrFocus = true;
        stopAuto();
        clearPendingResume();
      });
      carousel.addEventListener('focusout', (e) => {
        if (!carousel.contains(e.relatedTarget)) {
          isHoverOrFocus = false;
          pauseTemporarily();
        }
      });

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          goToSlide(activeIdx - 1, true);
          pauseTemporarily();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          goToSlide(activeIdx + 1, true);
          pauseTemporarily();
        });
      }

      carousel.addEventListener('keydown', (e) => {
        if (isGridMode()) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToSlide(activeIdx + 1, true);
          pauseTemporarily();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToSlide(activeIdx - 1, true);
          pauseTemporarily();
        } else if (e.key === 'Home') {
          e.preventDefault();
          goToSlide(0, true);
          pauseTemporarily();
        } else if (e.key === 'End') {
          e.preventDefault();
          goToSlide(slides.length - 1, true);
          pauseTemporarily();
        }
      });

      if (hasDesktopGrid) {
        const handleBreakpointChange = () => {
          if (isGridMode()) {
            stopAuto();
            clearPendingResume();
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
                clearPendingResume();
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
          clearPendingResume();
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
