(function () {
  const header = document.getElementById("header");
  const menuBtn = document.getElementById("menuBtn");
  const gnb = document.getElementById("gnb");
  const dim = document.getElementById("dim");
  const toTop = document.getElementById("toTop");

  // 스크롤 시 헤더 배경 전환
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // 모바일 메뉴
  const setMenu = (open) => {
    menuBtn.classList.toggle("is-open", open);
    gnb.classList.toggle("is-open", open);
    dim.classList.toggle("is-on", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  menuBtn.addEventListener("click", () => setMenu(!gnb.classList.contains("is-open")));
  dim.addEventListener("click", () => setMenu(false));
  gnb.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  // 맨 위로
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // 스크롤 등장 애니메이션 (같은 묶음 안에서는 순서대로 지연)
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  items.forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal"));
    el.style.transitionDelay = siblings.indexOf(el) * 0.08 + "s";
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => io.observe(el));
})();
