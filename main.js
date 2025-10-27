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
});
