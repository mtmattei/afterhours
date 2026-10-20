import {createClient} from '@supabase/supabase-js';
import {createAccounts} from './accounts-core.mjs';

const config = window.AFTERHOURS_AUTH;
if (config?.url && config?.publishableKey) {
  const client = createClient(config.url, config.publishableKey, {auth: {
    flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true,
    storageKey: 'afterhours-managed-session'
  }});
  let entry = Promise.resolve();
  const withEntryLock = work => {
    if(navigator.locks)return navigator.locks.request('afterhours-account-entry',work);
    const task = entry.then(work,work);entry=task.catch(()=>{});return task;
  };
  window.AfterhoursAccount = createAccounts(client.auth, localStorage,
    url => window.top.location.assign(url), new URL('account-callback.html', location.href).href.split('?')[0].split('#')[0],withEntryLock);
  let loader;
  window.AfterhoursAccount.challenge = async element => {
    if (!config.turnstileSiteKey) throw Error('Guest entry is waiting for the host to configure the security check.');
    if (!window.turnstile) {
      loader ||= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = resolve;
        script.onerror = () => { loader = null; reject(Error('The security check could not load. Please retry.')); };
        document.head.append(script);
      });
      await loader;
    }
    return new Promise((resolve, reject) => {
      const id = window.turnstile.render(element, {
        sitekey: config.turnstileSiteKey, theme: 'dark',
        callback: token => { window.turnstile.remove(id); resolve(token); },
        'error-callback': () => { window.turnstile.remove(id); reject(Error('The security check failed. Please retry.')); },
        'expired-callback': () => { window.turnstile.remove(id); reject(Error('The security check expired. Please retry.')); },
        'timeout-callback': () => { window.turnstile.remove(id); reject(Error('The security check timed out. Please retry.')); }
      });
    });
  };
}
