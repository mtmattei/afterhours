var UnoAppManifest = { displayName: 'Afterhours' };
window.AfterhoursUno = {
  prepareWebView() {
    const view = window.Microsoft?.UI?.Xaml?.Controls?.WebView;
    if (!view) return false;
    if (view.afterhoursIntegerIds) return true;
    let exports = view.unoExports;
    // Uno.WinUI 6.7.135's DOM IDs are strings; .NET 10 JSExport requires integers.
    // Preserve both dispatch operations and their return values.
    const wrap = original => original && ({
        ...original,
        DispatchLoadEvent: (id, url) => original.DispatchLoadEvent(Number(id), url),
        DispatchNewWindowRequested: original.DispatchNewWindowRequested
          ? (id, url, referer) => original.DispatchNewWindowRequested(Number(id), url, referer)
          : undefined
    });
    Object.defineProperty(view, 'unoExports', {
      configurable: true,
      get: () => exports,
      set: original => { exports = wrap(original); }
    });
    exports = wrap(exports);
    view.afterhoursIntegerIds = true;
    return true;
  }
};
