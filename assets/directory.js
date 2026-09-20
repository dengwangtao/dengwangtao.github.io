const searchInput = document.querySelector("#directory-search");
const clearButton = document.querySelector(".clear-search");
const pageCards = [...document.querySelectorAll("[data-page-card]")];
const folders = [...document.querySelectorAll("[data-folder]")].reverse();
const emptyState = document.querySelector("[data-search-empty]");

function normalize(value) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function updateDirectory() {
  const query = normalize(searchInput.value);
  let visiblePages = 0;

  for (const card of pageCards) {
    const visible = !query || normalize(card.dataset.search).includes(query);
    card.hidden = !visible;
    if (visible) visiblePages += 1;
  }

  for (const folder of folders) {
    const hasVisiblePage = Boolean(folder.querySelector("[data-page-card]:not([hidden])"));
    folder.hidden = !hasVisiblePage;
    if (query && hasVisiblePage) folder.open = true;
  }

  clearButton.classList.toggle("visible", Boolean(query));
  emptyState.hidden = visiblePages !== 0;
}

searchInput.addEventListener("input", updateDirectory);
clearButton.addEventListener("click", () => {
  searchInput.value = "";
  updateDirectory();
  searchInput.focus();
});
