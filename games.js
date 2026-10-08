// Hub + jogos. Cada jogo é uma função start(box, end) que devolve (opcional) uma função de limpeza.
const $ = s => document.querySelector(s);
const rand = n => Math.floor(Math.random() * n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current = null, stop = () => {}, padTurn = () => {};

// ---------- Nome do jogador ----------
try { $('#player').value = localStorage.getItem('player') || ''; } catch {}

// ---------- Filtros e catálogo ----------
document.querySelectorAll('.filters button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.game').forEach(g =>
    g.hidden = !!b.dataset.cat && !g.dataset.cats.split('|').includes(b.dataset.cat));
});
document.querySelectorAll('.game .play').forEach(b => b.onclick = () => play(b.closest('.game')));

// ---------- Placar ----------
async function loadBoard() {
  try {
    const rows = await (await fetch('/api/leaderboard')).json();
    $('#leaders').innerHTML = rows.length
      ? rows.map(r => `<li><b>${esc(r.player)}</b><span>${r.score}</span><small>${esc(r.game_name)}</small></li>`).join('')
      : '<li>Nenhuma pontuação ainda. Seja o primeiro.</li>';
  } catch { $('#leaders').innerHTML = '<li>Não foi possível carregar o placar.</li>'; }
}

// ---------- Ciclo de jogo ----------
function play(card) {
  stop(); current = card.dataset.id;
  $('#stage').hidden = false;
  $('#stage-title').textContent = card.dataset.name;
  $('#pad').hidden = current !== 'snake';
  const box = $('#board'); box.innerHTML = '';
  stop = GAMES[current](box, finish) || (() => {});
  $('#stage').scrollIntoView({ behavior: 'smooth' });
}

async function finish(score, msg) {
  const name = ($('#player').value.trim() || 'ANON').slice(0, 12);
  try { localStorage.setItem('player', name); } catch {}
  try {
    await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: name, game: current, score }) });
  } catch {}
  $('#m-score').textContent = score; $('#m-msg').textContent = msg;
  $('#modal').showModal(); loadBoard();
}
$('#again').onclick = () => { $('#modal').close(); play(document.querySelector(`.game[data-id="${current}"]`)); };
$('#close').onclick = () => $('#modal').close();
document.querySelectorAll('#pad button').forEach(b => b.onclick = () => padTurn(b.dataset.d));

// ---------- Jogo 1: Cobrinha (Canvas) ----------
function startSnake(box, end) {
  const N = 18, S = 20, c = document.createElement('canvas');
  c.width = c.height = N * S; box.append(c);
  const x = c.getContext('2d');
  let sn = [{x:9,y:9},{x:8,y:9},{x:7,y:9}], dir = {x:1,y:0}, next = dir, food, score = 0;
  const place = () => { do food = {x:rand(N), y:rand(N)}; while (sn.some(p => p.x === food.x && p.y === food.y)); };
  const DIRS = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
  padTurn = d => { const [dx, dy] = DIRS[d]; if (dx !== -dir.x || dy !== -dir.y) next = {x:dx, y:dy}; };
  const MAP = {ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
  const onKey = e => {
    if (e.target.matches('input, textarea')) return; // não roubar teclas do campo de nome
    const d = MAP[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (d) { e.preventDefault(); padTurn(d); } };
  addEventListener('keydown', onKey);
  place();
  const draw = () => {
    x.fillStyle = '#05040f'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#ff2e88'; x.fillRect(food.x*S+3, food.y*S+3, S-6, S-6);
    sn.forEach((p, i) => { x.fillStyle = i ? '#19e3ff' : '#ffd23f'; x.fillRect(p.x*S+1, p.y*S+1, S-2, S-2); });
  };
  const cleanup = () => { clearInterval(timer); removeEventListener('keydown', onKey); };
  const timer = setInterval(() => {
    dir = next;
    const h = {x: sn[0].x + dir.x, y: sn[0].y + dir.y};
    if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || sn.some(p => p.x === h.x && p.y === h.y)) {
      cleanup(); return end(score, `Comprimento final: ${sn.length}`);
    }
    sn.unshift(h);
    if (h.x === food.x && h.y === food.y) { score += 10; place(); } else sn.pop();
    draw();
  }, 120);
  draw(); return cleanup;
}

// ---------- Jogo 2: Memória ----------
function startMemory(box, end) {
  const em = ['🚀','👾','🍒','⭐','💎','🎲'];
  const deck = [...em, ...em].sort(() => Math.random() - .5);
  let open = [], moves = 0, found = 0, lock = false; const t0 = Date.now();
  const g = document.createElement('div'); g.className = 'mem';
  deck.forEach(e => {
    const b = document.createElement('button'); b.className = 'card'; b.setAttribute('aria-label', 'Carta');
    b.onclick = () => {
      if (lock || b.classList.contains('up')) return;
      b.classList.add('up'); b.textContent = e; open.push(b);
      if (open.length < 2) return;
      moves++; lock = true;
      if (open[0].textContent === open[1].textContent) {
        open = []; lock = false;
        if (++found === em.length) {
          const secs = Math.round((Date.now() - t0) / 1000);
          end(Math.max(50, 1000 - moves*25 - secs*5), `${moves} jogadas em ${secs}s`);
        }
      } else setTimeout(() => { open.forEach(o => { o.classList.remove('up'); o.textContent = ''; }); open = []; lock = false; }, 700);
    };
    g.append(b);
  });
  box.append(g);
}

// ---------- Jogo 3: Jogo da Velha com IA simples ----------
function startTTT(box, end) {
  const b = Array(9).fill(''); let over = false;
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win = p => L.some(l => l.every(i => b[i] === p));
  const free = () => b.map((v, i) => v ? null : i).filter(i => i !== null);
  const tryWin = p => free().find(i => { b[i] = p; const w = win(p); b[i] = ''; return w; });
  const g = document.createElement('div'); g.className = 'ttt';
  const cells = b.map((_, i) => { const c = document.createElement('button'); c.onclick = () => click(i); g.append(c); return c; });
  const check = () => {
    cells.forEach((c, i) => c.textContent = b[i]);
    const r = win('X') ? [100, 'Você venceu!'] : win('O') ? [0, 'A IA venceu.'] : !free().length ? [40, 'Empate.'] : null;
    if (r) { over = true; end(...r); }
    return over;
  };
  function click(i) {
    if (over || b[i]) return; b[i] = 'X'; if (check()) return;
    // IA: vence se puder, bloqueia, pega o centro, senão joga aleatório
    const f = free();
    b[tryWin('O') ?? tryWin('X') ?? (b[4] ? null : 4) ?? f[rand(f.length)]] = 'O';
    check();
  }
  box.append(g);
}

const GAMES = { snake: startSnake, memory: startMemory, ttt: startTTT };
loadBoard();
