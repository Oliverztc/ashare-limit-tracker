import React, { useEffect, useMemo, useState } from 'react'

const RULES = {
  MAIN: { label: '沪深主板', limit: 10 },
  ST: { label: 'ST/*ST', limit: 5 },
  GEM: { label: '创业板', limit: 20 },
  STAR: { label: '科创板', limit: 20 },
  BSE: { label: '北交所', limit: 30 },
}

const MOCK_ROWS = [
  {
    code: '600519', name: '贵州茅台', board: 'MAIN', market: 'SH', industry: '食品饮料',
    price: 1860.12, preClose: 1691.02, pctChg: 9.999, turnover: 52.6, amount: 96.2,
    volumeRatio: 1.8, sealAmount: 8.5, consecutive: 1, limitType: 'UP',
    firstLimitTime: '09:42:11', latestLimitTime: '14:28:22', tag: '机构抱团', reason: '白酒板块拉升，权重龙头强势封板',
  },
  {
    code: '300750', name: '宁德时代', board: 'GEM', market: 'SZ', industry: '电池',
    price: 242.4, preClose: 202, pctChg: 20, turnover: 86.2, amount: 141.3,
    volumeRatio: 2.3, sealAmount: 12.1, consecutive: 2, limitType: 'UP',
    firstLimitTime: '10:11:09', latestLimitTime: '13:56:31', tag: '赛道反弹', reason: '新能源权重回流，创业板核心资产涨停',
  },
  {
    code: '688041', name: '海光信息', board: 'STAR', market: 'SH', industry: '半导体',
    price: 148.32, preClose: 123.6, pctChg: 19.999, turnover: 54.1, amount: 82.8,
    volumeRatio: 3.4, sealAmount: 7.2, consecutive: 3, limitType: 'UP',
    firstLimitTime: '09:36:50', latestLimitTime: '14:51:08', tag: '算力链', reason: '国产算力链共振，科创板龙头涨停',
  },
  {
    code: '002594', name: '比亚迪', board: 'MAIN', market: 'SZ', industry: '汽车整车',
    price: 245.52, preClose: 272.8, pctChg: -9.999, turnover: 73.8, amount: 122.7,
    volumeRatio: 2.7, sealAmount: 9.8, consecutive: 1, limitType: 'DOWN',
    firstLimitTime: '10:23:45', latestLimitTime: '14:46:19', tag: '高位回撤', reason: '高景气板块出现集中兑现，主板权重跌停',
  },
]

function cls(...parts) { return parts.filter(Boolean).join(' ') }
function fmtNumber(value, digits = 2) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0))
}
function fmtAmountBillion(value) { return `${fmtNumber(value, 1)} 亿` }
function boardLimit(board) { return RULES[board]?.limit ?? 10 }
function getLimitStatus(row) {
  const limit = boardLimit(row.board)
  if (row.limitType === 'UP') return `涨停（${limit}%）`
  if (row.limitType === 'DOWN') return `跌停（${limit}%）`
  return `临界（${limit}%）`
}
function Badge({ children, type = 'default' }) {
  const map = {
    default: 'bg-slate-100 text-slate-700', up: 'bg-red-100 text-red-700', down: 'bg-emerald-100 text-emerald-700',
    info: 'bg-blue-100 text-blue-700', gold: 'bg-amber-100 text-amber-700',
  }
  return <span className={cls('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', map[type])}>{children}</span>
}
function MetricCard({ title, value, icon, sub, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-slate-50 text-slate-900 border-slate-200', red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200', blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <div className={cls('rounded-3xl border p-4 shadow-sm', toneMap[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">{title}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          <div className="mt-1 text-xs opacity-70">{sub}</div>
        </div>
        <div className="rounded-2xl bg-white/70 px-3 py-2 text-base">{icon}</div>
      </div>
    </div>
  )
}
function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} className={cls('rounded-full border px-3 py-1.5 text-sm transition', active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900')}>
      {children}
    </button>
  )
}

export default function App() {
  const today = new Date().toISOString().slice(0, 10)
  const [rows, setRows] = useState(MOCK_ROWS)
  const [selected, setSelected] = useState(MOCK_ROWS[0])
  const [query, setQuery] = useState('')
  const [market, setMarket] = useState('ALL')
  const [board, setBoard] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [minConsecutive, setMinConsecutive] = useState(0)
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ashare-watchlist') || '[]') } catch { return [] }
  })
  const [mode, setMode] = useState('API')
  const [tradeDate, setTradeDate] = useState(today)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    localStorage.setItem('ashare-watchlist', JSON.stringify(watchlist))
  }, [watchlist])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      if (mode === 'MOCK') {
        setRows(MOCK_ROWS)
        setSelected(MOCK_ROWS[0])
      } else {
        const base = import.meta.env.VITE_API_BASE_URL || ''
        const res = await fetch(`${base}/api/market/limits?trade_date=${tradeDate}`)
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        const nextRows = json.data || []
        setRows(nextRows)
        setSelected((prev) => nextRows.find((x) => x.code === prev?.code) || nextRows[0] || null)
      }
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message || '刷新失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [mode, tradeDate])
  useEffect(() => {
    if (!autoRefresh || mode !== 'API') return
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [autoRefresh, mode, tradeDate])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const keyword = query.toLowerCase()
      const hitQuery = !query || row.name.toLowerCase().includes(keyword) || row.code.includes(query) || String(row.industry || '').toLowerCase().includes(keyword) || String(row.tag || '').toLowerCase().includes(keyword)
      const hitMarket = market === 'ALL' || row.market === market
      const hitBoard = board === 'ALL' || row.board === board
      const hitType = type === 'ALL' || row.limitType === type
      const hitConsecutive = row.consecutive >= minConsecutive
      return hitQuery && hitMarket && hitBoard && hitType && hitConsecutive
    })
  }, [rows, query, market, board, type, minConsecutive])

  const stats = useMemo(() => {
    const ups = rows.filter((x) => x.limitType === 'UP')
    const downs = rows.filter((x) => x.limitType === 'DOWN')
    const highest = [...rows].sort((a, b) => b.consecutive - a.consecutive)[0]
    const hottest = [...rows].sort((a, b) => b.amount - a.amount)[0]
    return {
      upCount: ups.length,
      downCount: downs.length,
      hitRate: rows.length ? `${fmtNumber((ups.length / rows.length) * 100, 1)}%` : '0%',
      highest: highest ? `${highest.consecutive} 连板` : '-',
      hottest: hottest ? `${hottest.name} ${fmtAmountBillion(hottest.amount)}` : '-',
    }
  }, [rows])

  const watchRows = useMemo(() => rows.filter((row) => watchlist.includes(row.code)), [rows, watchlist])
  const toggleWatch = (code) => setWatchlist((prev) => prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"><span>●</span>A股涨跌停追踪台</div>
                  <h1 className="mt-3 text-2xl font-semibold md:text-3xl">实时监控涨停 / 跌停 / 连板 / 封单</h1>
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">默认会直接请求同域名下的后端 API，部署后打开网址即可使用。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill active={mode === 'API'} onClick={() => setMode('API')}>真实 API</Pill>
                  <Pill active={mode === 'MOCK'} onClick={() => setMode('MOCK')}>模拟数据</Pill>
                  <button onClick={refresh} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><span>{loading ? '⟳' : '↻'}</span>刷新</button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="涨停家数" value={stats.upCount} icon="📈" sub="含连板与首板" tone="red" />
                <MetricCard title="跌停家数" value={stats.downCount} icon="📉" sub="情绪转弱时重点观察" tone="green" />
                <MetricCard title="涨停占比" value={stats.hitRate} icon="％" sub="样本内上涨强度" tone="blue" />
                <MetricCard title="最高连板" value={stats.highest} icon="🔥" sub="短线高度标杆" tone="slate" />
                <MetricCard title="成交额龙头" value={stats.hottest} icon="💰" sub="资金关注度" tone="slate" />
              </div>

              <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-[220px_180px_1fr]">
                  <label>
                    <div className="mb-1 text-xs text-slate-500">交易日期</div>
                    <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                  </label>
                  <label className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />15 秒自动刷新</label>
                  <label className="relative min-w-0 flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索代码 / 名称 / 行业 / 标签" className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400" /></label>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid grid-cols-2 gap-3 md:flex">
                    <select value={market} onChange={(e) => setMarket(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value="ALL">全部市场</option><option value="SH">上交所</option><option value="SZ">深交所</option><option value="BJ">北交所</option>
                    </select>
                    <select value={board} onChange={(e) => setBoard(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value="ALL">全部板块</option><option value="MAIN">主板</option><option value="GEM">创业板</option><option value="STAR">科创板</option><option value="BSE">北交所</option><option value="ST">ST</option>
                    </select>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value="ALL">全部类型</option><option value="UP">仅涨停</option><option value="DOWN">仅跌停</option>
                    </select>
                    <select value={minConsecutive} onChange={(e) => setMinConsecutive(Number(e.target.value))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value={0}>全部连板</option><option value={1}>1板以上</option><option value={2}>2板以上</option><option value={3}>3板以上</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500"><span>🕒</span>最近更新时间：{lastUpdated.toLocaleTimeString('zh-CN')}</div>
                </div>
              </div>

              {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            </div>

            <div className="rounded-[28px] bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">实时榜单</div>
                  <div className="mt-1 text-sm text-slate-500">共 {filtered.length} 条，支持按市场、板块、连板数和关键词筛选</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"><span>筛</span>Trade Date: {tradeDate}</div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="grid grid-cols-[100px_1.4fr_110px_90px_90px_100px_100px_100px_84px] gap-3 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
                  <div>代码</div><div>名称 / 行业</div><div>板块</div><div>状态</div><div>涨跌幅</div><div>成交额</div><div>封单额</div><div>首次封板</div><div>关注</div>
                </div>
                <div className="max-h-[560px] overflow-auto">
                  {filtered.map((row) => {
                    const watching = watchlist.includes(row.code)
                    return (
                      <button key={row.code} onClick={() => setSelected(row)} className={cls('grid w-full grid-cols-[100px_1.4fr_110px_90px_90px_100px_100px_100px_84px] gap-3 border-t border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50', selected?.code === row.code && 'bg-slate-50')}>
                        <div><div className="font-medium">{row.code}</div><div className="text-xs text-slate-400">{row.market}</div></div>
                        <div className="min-w-0"><div className="truncate font-medium text-slate-900">{row.name}</div><div className="truncate text-xs text-slate-500">{row.industry} · {row.tag}</div></div>
                        <div><Badge type="info">{RULES[row.board]?.label || row.board}</Badge></div>
                        <div><Badge type={row.limitType === 'UP' ? 'up' : 'down'}>{row.limitType === 'UP' ? '涨停' : '跌停'}</Badge></div>
                        <div className={cls('font-medium', row.limitType === 'UP' ? 'text-red-600' : 'text-emerald-600')}>{row.pctChg > 0 ? '+' : ''}{fmtNumber(row.pctChg, 3)}%</div>
                        <div>{fmtAmountBillion(row.amount)}</div>
                        <div>{fmtAmountBillion(row.sealAmount)}</div>
                        <div>{row.firstLimitTime}</div>
                        <div><span onClick={(e) => { e.stopPropagation(); toggleWatch(row.code) }} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900">{watching ? '★' : '☆'}</span></div>
                      </button>
                    )
                  })}
                  {!filtered.length ? <div className="px-4 py-10 text-center text-sm text-slate-500">当前条件下没有匹配结果</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-lg font-semibold">个股详情</div><div className="mt-1 text-sm text-slate-500">点击左侧榜单可切换详情</div></div>
                {selected ? <Badge type={selected.limitType === 'UP' ? 'up' : 'down'}>{getLimitStatus(selected)}</Badge> : null}
              </div>
              {selected ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-xl font-semibold">{selected.name}</div><div className="mt-1 text-sm text-slate-500">{selected.code} · {selected.industry}</div></div>
                      <button onClick={() => toggleWatch(selected.code)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"><span>{watchlist.includes(selected.code) ? '★' : '☆'}</span>{watchlist.includes(selected.code) ? '已关注' : '加入关注'}</button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-2xl bg-white p-3"><div className="text-slate-500">现价</div><div className="mt-1 font-semibold">{fmtNumber(selected.price)}</div></div>
                      <div className="rounded-2xl bg-white p-3"><div className="text-slate-500">昨收</div><div className="mt-1 font-semibold">{fmtNumber(selected.preClose)}</div></div>
                      <div className="rounded-2xl bg-white p-3"><div className="text-slate-500">换手率</div><div className="mt-1 font-semibold">{fmtNumber(selected.turnover, 1)}%</div></div>
                      <div className="rounded-2xl bg-white p-3"><div className="text-slate-500">量比</div><div className="mt-1 font-semibold">{fmtNumber(selected.volumeRatio, 1)}</div></div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 p-4">
                      <div className="text-sm font-medium">封板信息</div>
                      <div className="mt-3 space-y-3 text-sm">
                        <div className="flex items-center justify-between"><span className="text-slate-500">首次封板</span><span>{selected.firstLimitTime}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">最后封板</span><span>{selected.latestLimitTime}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">封单额</span><span>{fmtAmountBillion(selected.sealAmount)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">连板高度</span><span>{selected.consecutive} 连板</span></div>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 p-4">
                      <div className="text-sm font-medium">标签与逻辑</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge type="gold">{selected.tag}</Badge><Badge type="info">{RULES[selected.board]?.label || selected.board}</Badge><Badge type={selected.limitType === 'UP' ? 'up' : 'down'}>{selected.limitType === 'UP' ? '上涨情绪' : '下跌情绪'}</Badge>
                      </div>
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{selected.reason}</div>
                    </div>
                  </div>
                </div>
              ) : <div className="mt-4 rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">暂无数据</div>}
            </div>

            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><div><div className="text-lg font-semibold">我的关注</div><div className="mt-1 text-sm text-slate-500">适合开盘盯盘或盘后复盘</div></div><span className="text-slate-400">🔔</span></div>
              <div className="mt-4 space-y-3">
                {watchRows.length ? watchRows.map((row) => (
                  <button key={row.code} onClick={() => setSelected(row)} className="flex w-full items-center justify-between rounded-3xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
                    <div><div className="font-medium">{row.name} <span className="text-sm text-slate-400">{row.code}</span></div><div className="mt-1 text-xs text-slate-500">{row.industry} · {row.consecutive} 连板</div></div>
                    <div className={cls('text-sm font-semibold', row.limitType === 'UP' ? 'text-red-600' : 'text-emerald-600')}>{row.pctChg > 0 ? '+' : ''}{fmtNumber(row.pctChg, 3)}%</div>
                  </button>
                )) : <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">还没有关注的股票，点击榜单右侧星标即可加入</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
