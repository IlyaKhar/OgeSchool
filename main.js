document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.style.boxShadow = y > 8 ? '0 2px 8px rgba(15,23,42,.06)' : 'none';
    header.classList.toggle('condensed', y > 8);
  });

  // reveal on scroll
  const revealEls = document.querySelectorAll('.feature, .hero-text, .card-sample');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('reveal');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  revealEls.forEach((el) => io.observe(el));

  // Форма обратной связи на главной (отправка на бэкенд, без перехода в почтовый клиент)
  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    const statusEl = document.getElementById('feedbackStatus');

    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(feedbackForm);
      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();

      if (!message) {
        if (statusEl) {
          statusEl.textContent = 'Напишите, пожалуйста, хотя бы пару слов.';
          statusEl.className = 'feedback-status error';
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = 'Отправляем отзыв...';
        statusEl.className = 'feedback-status';
      }

      try {
        if (window.apiClient) {
          await window.apiClient.post('/api/feedback', { name, email, message });
        } else {
          const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${response.status}`);
          }
        }

        if (statusEl) {
          statusEl.textContent = 'Спасибо! Отзыв отправлен.';
          statusEl.className = 'feedback-status success';
        }
        feedbackForm.reset();
      } catch (error) {
        console.error('Feedback send error:', error);
        if (statusEl) {
          statusEl.textContent = error.message || 'Не удалось отправить отзыв. Попробуйте позже.';
          statusEl.className = 'feedback-status error';
        }
      }
    });
  }
});
