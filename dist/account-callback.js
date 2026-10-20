(() => {
  const configured = window.AFTERHOURS_AUTH?.returnTo || '/';
  const target = new URL(configured, location.origin);
  const back = document.getElementById('back');
  back.href = target.origin === location.origin ? target.href : location.origin;
  Promise.resolve().then(async () => {
    if (!window.AfterhoursAccount) throw Error('Account recovery has not been configured by the host.');
    await window.AfterhoursAccount.finish(location.search);
    history.replaceState(null, '', location.pathname);
    location.replace(back.href);
  }).catch(error => {
    history.replaceState(null, '', location.pathname);
    document.getElementById('status').textContent = error.message;
  });
})();
