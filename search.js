const q = encodeURIComponent("Missing field 'tsconfigPaths' on BindingViteResolvePluginConfig.resolveOptions");
fetch('https://html.duckduckgo.com/html/?q=' + q)
  .then(r => r.text())
  .then(html => {
    const urls = [];
    const regex = /<a class="result__url" href="\/l\/\?uddg=([^"]+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      urls.push(decodeURIComponent(match[1]));
    }
    console.log(urls.join('\n'));
  });
