const diagrams = [...document.querySelectorAll(".mermaid")];

if (diagrams.length > 0) {
  try {
    const { default: mermaid } = await import(
      "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
    );

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "dark"
    });

    await mermaid.run({ nodes: diagrams });
  } catch (error) {
    console.error("Mermaid 图表渲染失败", error);
    for (const diagram of diagrams) diagram.classList.add("mermaid-error");
  }
}
