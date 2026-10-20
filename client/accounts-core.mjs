// The SDK owns token refresh. A remembered identity must never be replaced
// automatically when a request fails or a refresh token becomes unavailable.
export function createAccounts(auth, storage, navigate, callbackUrl, withEntryLock = work => work()) {
  const marker = 'afterhours-account-id';
  async function session() {
    const {data, error} = await auth.getSession();
    if (error) throw error;
    return data.session;
  }
  async function current() {
    const value = await session();
    return value ? {id: value.user.id, anonymous: value.user.is_anonymous === true} : null;
  }
  async function enter(captchaToken) {
    let value = await session();
    if (!value) {
      if (storage.getItem(marker)) throw Error('Your saved character needs you to sign in again. Use Restore account. An unlinked guest cannot be recovered after its browser session is lost.');
      if (!captchaToken) throw Error('Complete the quick security check to join.');
      const {data, error} = await auth.signInAnonymously({options: {captchaToken}});
      if (error) throw error;
      value = data.session;
    }
    if (!value) throw Error('Sign-in did not finish. Please try again.');
    const remembered = storage.getItem(marker);
    if (remembered && remembered !== value.user.id) throw Error('A different account is signed in. Use Restore account to choose it explicitly.');
    storage.setItem(marker, value.user.id);
    return value.access_token;
  }
  async function token() {
    const value = await session();
    if (!value) throw Error('Sign in again to continue your saved character.');
    if (storage.getItem(marker) !== value.user.id) throw Error('Your account changed. Reopen the shared world.');
    return value.access_token;
  }
  async function redirect(mode) {
    const value = await session();
    if (mode === 'link' && !value) throw Error('Join as a guest first.');
    storage.setItem('afterhours-account-flow', JSON.stringify({mode, id: value?.user.id}));
    const args = {provider: 'google', options: {redirectTo: callbackUrl, skipBrowserRedirect: true}};
    const {data, error} = mode === 'link' ? await auth.linkIdentity(args) : await auth.signInWithOAuth(args);
    if (error) throw error;
    if (!data.url) throw Error('Account sign-in could not start.');
    navigate(data.url);
  }
  async function finish(search) {
    const params = new URLSearchParams(search);
    if (params.has('error')) throw Error('Sign-in was cancelled or could not finish. Return to the game and try again.');
    const code = params.get('code');
    if (!code) throw Error('The sign-in link is incomplete. Return to the game and try again.');
    const flow = JSON.parse(storage.getItem('afterhours-account-flow') || 'null');
    if (!flow || !['link', 'restore'].includes(flow.mode)) throw Error('Start sign-in from the game in this browser.');
    const {data, error} = await auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (flow.mode === 'link' && data.session.user.id !== flow.id) throw Error('The linked account did not match your guest. Your world data has not been moved.');
    storage.setItem(marker, data.session.user.id);
    storage.setItem('afterhours-account-resume', '1');
    storage.removeItem('afterhours-account-flow');
  }
  return {enter: captcha => withEntryLock(() => enter(captcha)), token, current, link: () => redirect('link'), restore: () => redirect('restore'), finish,
    remembered: () => !!storage.getItem(marker)};
}
