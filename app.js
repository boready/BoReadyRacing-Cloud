'use strict';

const $ = id => document.getElementById(id);
const statuses = ['New', 'Ready to Contact', 'Contacted', 'Follow-up Due', 'Interested', 'Proposal Sent', 'Sponsored', 'Declined', 'Do Not Contact'];
const fields = ['name', 'city', 'state', 'website', 'email', 'email_source', 'category', 'status', 'last_contact', 'follow_up', 'notes'];
let db = null;
let currentUser = null;
let rows = [];
let authVersion = 0;
let loadVersion = 0;
let activeLoad = false;

function setMessage(message) { $('message').textContent = message; }
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function mailto(lead) {
  const subject = '2027 Sponsorship Opportunity — Bo Ready Racing #38';
  const body = `Hello ${lead.name} team,\n\nI’m reaching out with Bo Ready Racing #38 about a potential partnership for the 2027 racing season. We are a family-oriented racing team, and I am a U.S. Army veteran. We offer sponsor logo placement on our race car, race-day photos, social media recognition, and season updates. I would appreciate the opportunity to discuss sponsorship.\n\nThank you,\nBo Ready Racing #38\nhttps://www.facebook.com/BoReadyRacing`;
  return `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function render() {
  const term = $('search').value.trim().toLowerCase();
  const state = $('state-filter').value;
  const status = $('status-filter').value;
  const filtered = rows.filter(r =>
    (!state || r.state === state) &&
    (!status || r.status === status) &&
    (!term || [r.name, r.city, r.email].some(v => String(v || '').toLowerCase().includes(term)))
  );
  const today = new Date().toISOString().slice(0, 10);
  $('stats').replaceChildren(
    node('span', `${rows.length} total leads`),
    node('span', `${rows.filter(r => r.status === 'Sponsored').length} sponsors`),
    node('span', `${rows.filter(r => r.follow_up && r.follow_up <= today && !['Sponsored', 'Do Not Contact'].includes(r.status)).length} follow-ups due`)
  );
  const list = $('leads');
  list.replaceChildren();
  if (!filtered.length) list.append(node('p', 'No matching leads.'));
  for (const lead of filtered) {
    const item = node('article', undefined, 'lead');
    item.append(
      node('h3', lead.name),
      node('p', `${lead.city}, ${lead.state} · ${lead.category || 'Uncategorized'} · ${lead.status}`),
      node('p', `${lead.email}${lead.follow_up ? ` · Follow-up ${lead.follow_up}` : ''}`)
    );
    const actions = node('div', undefined, 'lead-actions');
    if (lead.status !== 'Do Not Contact') {
      const mail = node('a', 'Draft email');
      mail.href = mailto(lead);
      actions.append(mail);
    }
    const edit = node('button', 'Edit', 'secondary');
    edit.type = 'button';
    edit.addEventListener('click', () => openEditor(lead));
    actions.append(edit);
    const website = safeUrl(lead.website);
    if (website) {
      const link = node('a', 'Website');
      link.href = website;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actions.append(link);
    }
    item.append(actions);
    list.append(item);
  }
}
async function refresh() {
  if (!db || !currentUser || activeLoad) return;
  activeLoad = true;
  const version = ++loadVersion;
  const owner = currentUser.id;
  setMessage('Loading…');
  try {
    const { data, error } = await db.from('leads')
      .select('*')
      .eq('owner_id', owner)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (version !== loadVersion || currentUser?.id !== owner) return;
    if (error) {
      setMessage(`Database error: ${error.message}`);
      return;
    }
    rows = data || [];
    setMessage(`Showing ${rows.length} leads (up to 5000).`);
    render();
  } catch (error) {
    if (version === loadVersion) setMessage(`Unable to load leads: ${error.message}`);
  } finally {
    activeLoad = false;
  }
}
function openEditor(lead = null) {
  if (!currentUser) return;
  $('lead-form').reset();
  $('lead-id').value = lead?.id || '';
  $('editor-title').textContent = lead ? 'Edit sponsor' : 'Add sponsor';
  $('edit-error').textContent = '';
  for (const key of fields) if (lead && lead[key] != null) $(key).value = lead[key];
  $('delete-btn').classList.toggle('hidden', !lead);
  $('editor').showModal();
}
async function saveLead(event) {
  event.preventDefault();
  if (!currentUser) return;
  $('edit-error').textContent = '';
  const record = {};
  for (const key of fields) record[key] = $(key).value.trim();
  for (const key of ['last_contact', 'follow_up']) if (!record[key]) record[key] = null;
  record.email = record.email.toLowerCase();
  record.website = record.website ? safeUrl(record.website) : '';
  record.email_source = safeUrl(record.email_source);
  if (!record.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    $('edit-error').textContent = 'A valid public business email is required.';
    return;
  }
  if (!record.email_source) {
    $('edit-error').textContent = 'A valid public source URL is required.';
    return;
  }
  if (record.website === null) {
    $('edit-error').textContent = 'Invalid website URL.';
    return;
  }
  const id = $('lead-id').value;
  const submit = $('lead-form').querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const result = id
      ? await db.from('leads').update(record).eq('id', id).eq('owner_id', currentUser.id)
      : await db.from('leads').insert({ ...record, owner_id: currentUser.id });
    if (result.error) {
      $('edit-error').textContent = result.error.message;
      return;
    }
    $('editor').close();
    await refresh();
  } catch (error) {
    $('edit-error').textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
}
async function deleteLead() {
  const id = $('lead-id').value;
  if (!currentUser || !id || !confirm('Permanently delete this lead?')) return;
  const { error } = await db.from('leads').delete().eq('id', id).eq('owner_id', currentUser.id);
  if (error) {
    $('edit-error').textContent = error.message;
    return;
  }
  $('editor').close();
  await refresh();
}
function exportCsv() {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [fields.map(quote).join(','), ...rows.map(r => fields.map(k => quote(r[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'BoReadyRacing_Leads_Backup.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showAuthenticated(user) {
  const previousId = currentUser?.id;
  currentUser = user;
  $('auth').classList.toggle('hidden', Boolean(user));
  $('app').classList.toggle('hidden', !user);
  if (!user) {
    loadVersion++;
    rows = [];
    activeLoad = false;
    $('login-password').value = '';
    return;
  }
  if (previousId !== user.id) {
    rows = [];
    render();
    void refresh();
  }
}
async function init() {
  for (const status of statuses) {
    $('status').append(new Option(status, status));
    $('status-filter').append(new Option(status, status));
  }
  const config = window.SPONSOR_CONFIG;
  if (!config?.url || !config?.anonKey || config.url.includes('YOUR-PROJECT') || (config.anonKey.includes('YOUR-') || config.anonKey.includes('PASTE_'))) {
    $('setup').classList.remove('hidden');
    return;
  }
  db = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Never call getUser(), getSession(), refreshSession(), or database queries
  // from inside this synchronous Supabase auth callback.
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showAuthenticated(null);
    } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const user = session?.user || null;
      // TOKEN_REFRESHED should not trigger another database load.
      if (event !== 'TOKEN_REFRESHED' || currentUser?.id !== user?.id) showAuthenticated(user);
    }
  });

  $('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('auth-error').textContent = '';
    const button = $('auth-form').querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: $('login-email').value.trim(),
        password: $('login-password').value
      });
      if (error) $('auth-error').textContent = error.message;
      else if (data?.user) showAuthenticated(data.user);
    } catch (error) {
      $('auth-error').textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });
  $('logout-btn').addEventListener('click', async () => {
    const { error } = await db.auth.signOut();
    if (error) setMessage(error.message);
  });
  $('new-btn').addEventListener('click', () => openEditor());
  $('cancel-btn').addEventListener('click', () => $('editor').close());
  $('delete-btn').addEventListener('click', deleteLead);
  $('lead-form').addEventListener('submit', saveLead);
  $('export-btn').addEventListener('click', exportCsv);
  for (const key of ['search', 'state-filter', 'status-filter']) {
    $(key).addEventListener(key === 'search' ? 'input' : 'change', render);
  }
}
init().catch(error => {
  $('setup').classList.remove('hidden');
  $('setup').append(node('p', error.message, 'error'));
});
