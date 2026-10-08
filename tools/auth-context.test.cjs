const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Hook-level harness: executes the actual provider without a browser or new dependencies.
// Browser cookie acceptance and React DOM navigation still need deployed browser testing.
function harness(fetch) {
  const slots = [], effects = [], navigation = [];
  let cursor = 0, mounted = false;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: fn => { if (!mounted) effects.push(fn); },
  };
  const source = fs.readFileSync(path.join(__dirname, '../contexts/AuthContext.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Headers, fetch, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-router-dom') return { useNavigate: () => (...args) => navigation.push(args) };
    if (name === '../src/config') return { API_URL: 'https://api.example.invalid/api' };
    if (name === '../types') return { UserRole: { MANAGER: 'manager' } };
    throw new Error(name);
  } });
  return {
    render() { cursor = 0; const tree = exports.AuthProvider({ children: null }); mounted = true; return tree.props.value; },
    async restore() { effects.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); },
    navigation,
  };
}
const response = (status, body = {}) => new Response(JSON.stringify(body), { status });
const session = { user: { id: 7, role: 'employee', companyId: 2 }, csrfToken: 'csrf', token: 'session-token' };

for (const method of ['login', 'googleLogin']) {
  test(`${method}: initial 401 is normal; immediate request uses new credentials without re-render`, async () => {
    const calls = [];
    const app = harness(async (url, init) => {
      calls.push({ url, init });
      return url.endsWith('/session') ? response(401) : response(200, session);
    });
    app.render(); await app.restore();
    const auth = app.render();
    assert.equal(auth.currentUser, null);
    const result = await auth[method]('test', 'password');
    assert.equal(result.success, true);
    await auth.apiFetch('/protected', { method: 'POST' });
    const request = calls.at(-1).init;
    assert.equal(request.headers.get('Authorization'), 'Bearer session-token');
    assert.equal(request.headers.get('X-CSRF-Token'), 'csrf');
    assert.equal(request.credentials, 'include');
    assert.equal(app.navigation[0][0], '/dashboard');
    assert.equal(calls.filter(call => call.url.endsWith('/session')).length, 1);
  });
}

test('cookie restoration supplies bearer credentials; failed logout retains session; successful logout clears it', async () => {
  let logoutStatus = 503, latest;
  const app = harness(async (url, init) => {
    latest = init;
    return url.endsWith('/logout') ? response(logoutStatus) : response(200, session);
  });
  app.render(); await app.restore();
  const auth = app.render();
  assert.equal(latest.credentials, 'include');
  assert.equal(auth.currentUser.id, 7);
  await assert.rejects(auth.logout(), /Sign-out failed/);
  assert.equal(app.render().currentUser.id, 7);
  logoutStatus = 200;
  await auth.logout();
  await auth.apiFetch('/protected');
  assert.equal(latest.headers.has('Authorization'), false);
  assert.equal(app.render().currentUser, null);
});

test('network failure during restoration leaves sign-in usable; failed login does not navigate', async () => {
  const app = harness(async url => {
    if (url.endsWith('/session')) throw new Error('offline');
    return response(401, { message: 'Invalid credentials' });
  });
  app.render(); await app.restore();
  const auth = app.render();
  assert.equal(auth.loading, false);
  assert.equal((await auth.login('test', 'wrong')).success, false);
  assert.equal(app.navigation.length, 0);
});
