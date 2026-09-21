const tableOfContents = document.querySelector("[data-article-toc]");

if (tableOfContents) {
  const toggle = tableOfContents.querySelector("[data-toc-toggle]");
  const links = [...tableOfContents.querySelectorAll("[data-toc-link]")];
  const storageKey = "markdown-toc-collapsed";

  const setCollapsed = collapsed => {
    tableOfContents.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = collapsed ? "显示" : "隐藏";
    toggle.title = collapsed ? "显示本文目录" : "隐藏本文目录";
  };

  try {
    setCollapsed(localStorage.getItem(storageKey) === "true");
  } catch {
    setCollapsed(false);
  }

  toggle.addEventListener("click", () => {
    const collapsed = !tableOfContents.classList.contains("is-collapsed");
    setCollapsed(collapsed);

    try {
      localStorage.setItem(storageKey, String(collapsed));
    } catch {
      // 浏览器禁用本地存储时，折叠功能仍在当前页面有效。
    }
  });

  const sections = links
    .map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length > 0) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];

      if (!visible) return;

      for (const link of links) {
        link.classList.toggle(
          "is-active",
          decodeURIComponent(link.hash.slice(1)) === visible.target.id
        );
      }
    }, {
      rootMargin: "-12% 0px -72% 0px"
    });

    for (const section of sections) observer.observe(section);
  }
}
