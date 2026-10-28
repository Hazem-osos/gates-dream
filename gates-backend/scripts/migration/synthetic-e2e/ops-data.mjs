// Synthetic operational documents for GatesSyntheticLegacy (items, invoices, cash, cheques, stock).
// Every posted document gets its own posted GL voucher (as PostInvoice / SavePayment do), so the
// trial balance stays the financial source of truth. Numbers deliberately collide across branches
// and across document types — the cases that break naive target keys.
export const EXPECT = {};

export async function buildOps({ insert, voucher, customers, suppliers, CC }) {
  const Y = '2026';
  const d = (m, day) => `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // ---- stores / items / units --------------------------------------------------------
  // (Store rows were inserted by the base loader without level/leaf flags; replace them.)
  const items = Array.from({ length: 12 }, (_, i) => ({
    code: `I${String(i + 1).padStart(3, '0')}`,
    parent: i < 6 ? 'G1' : 'G2',
    name: `صنف اختبار ${i + 1}`,
    price: 20 + i * 5,
    box: i < 4, // I001..I004 also sold by BOX of 12
  }));
  await insert('Item', [
    { CompanyCode: CC, ItemCode: 'G1', ParentItem: '', FullPath: 'G1', ItemLevel: 1, ItemNameA: 'مجموعة أ', ItemNameE: 'Group A', ItemStatus: 'A', ItemType: 'C', HasChild: 'T', Deleted: 'F', ItemCat: 'N' },
    { CompanyCode: CC, ItemCode: 'G2', ParentItem: '', FullPath: 'G2', ItemLevel: 1, ItemNameA: 'مجموعة ب', ItemNameE: 'Group B', ItemStatus: 'A', ItemType: 'C', HasChild: 'T', Deleted: 'F', ItemCat: 'N' },
    ...items.map((it) => ({
      CompanyCode: CC, ItemCode: it.code, ParentItem: it.parent, FullPath: `${it.parent}${it.code}`, ItemLevel: 2,
      ItemNameA: it.name, ItemNameE: `Item ${it.code}`, ItemStatus: 'A', ItemType: 'D', HasChild: 'F', Deleted: 'F', ItemCat: 'N',
    })),
    // Deleted item that still appears on a posted purchase (history must keep it).
    { CompanyCode: CC, ItemCode: 'I013', ParentItem: 'G2', FullPath: 'G2I013', ItemLevel: 2, ItemNameA: 'صنف ملغي', ItemNameE: 'Retired item', ItemStatus: 'A', ItemType: 'D', HasChild: 'F', Deleted: 'T', ItemCat: 'N' },
  ]);
  await insert('ItemUnit', [
    { CompanyCode: CC, ItemCode: 'I013', UnitCode: 'PCS', UnitNameA: 'قطعة', UnitNameE: 'Piece', Change: 1, Fixed: 'T', BarCode: '62I013', Price1: 10 },
    ...items.map((it) => ({ CompanyCode: CC, ItemCode: it.code, UnitCode: 'PCS', UnitNameA: 'قطعة', UnitNameE: 'Piece', Change: 1, Fixed: 'T', BarCode: `62${it.code}`, Price1: it.price })),
    ...items.filter((it) => it.box).map((it) => ({ CompanyCode: CC, ItemCode: it.code, UnitCode: 'BOX', UnitNameA: 'كرتونة', UnitNameE: 'Box', Change: 12, Fixed: 'F', BarCode: `63${it.code}`, Price1: it.price * 12 })),
  ]);

  // ---- running stock model (to keep every outbound covered) --------------------------
  const stock = new Map(); // `${store}|${item}` -> qty
  const bump = (store, item, q) => stock.set(`${store}|${item}`, (stock.get(`${store}|${item}`) ?? 0) + q);
  const glNext = { '01': 300, '02': 100, '01|2025': 0 };
  const nextGl = (br, year = Y) => {
    const k = year === Y ? br : `${br}|${year}`;
    glNext[k] = (glNext[k] ?? 0) + 1;
    return glNext[k];
  };

  const invH = [];
  const invD = [];
  const invoices = new Map(); // `${br}|${type}|${num}` -> header
  function invoice({ br, type, num, date, partyAcc, store, lines, status = 'Post', deleted = 'F', ret, paid = 0, year = Y, currency = 'EGP', change = 1 }) {
    let total = 0;
    lines.forEach((l, i) => {
      l.price = Math.round(l.price * 100) / 100;
      if (l.cost != null) l.cost = Math.round(l.cost * 100) / 100;
      const value = Math.round(l.qty2 * l.price * 100) / 100;
      total += value;
      invD.push({
        CompanyCode: CC, BranchCode: br, YearID: year, InvoiceNum: String(num), Type: type, ItemCode: l.item,
        UnitCode1: l.unit, Qty1: l.qty2, UnitCode2: 'PCS', Qty2: l.qty1, Price: l.price, TotalValue: value,
        DiscPercent: 0, DiscValue: 0, DaribaPercent: 0, DaribaValue: 0, NetValue: value, StoreCode: store,
        GridNum: i + 1, Serial: String(i + 1), CostPrice: l.cost ?? null, CCenter: null,
      });
    });
    total = Math.round(total * 100) / 100;
    const posted = status === 'Post' && deleted !== 'T';
    const glNum = posted ? nextGl(br, year) : null;
    const h = {
      CompanyCode: CC, BranchCode: br, YearID: year, InvoiceNum: String(num), DescA: `فاتورة ${type} ${num}`, Type: type,
      Date: date, Status: status, Deleted: deleted, CurrencyCode: currency, SupplierAccountCode: partyAcc, StoreCode: store,
      GLNum: glNum ? String(glNum).padStart(8, '0') : null, AllowReturn: 'T', Days: 0, TotalAmount: total,
      SalesDaribaAmount: 0, NetAmount: total, AffectStore: 'T', OfferAmount: 0, Change: change, PaidAmount: paid,
      ReturnInvoiceNum: ret?.num ?? null, ReturnInvoiceYearID: ret ? year : null, ReturnInvoiceType: ret?.type ?? null,
      CashType: null, Id: invH.length + 1,
    };
    invH.push(h);
    invoices.set(year === Y ? `${br}|${type}|${num}` : `${br}|${type}|${num}|${year}`, { h, total });
    return { glNum, total, h };
  }
  function glFor(br, glNum, date, type, lines, opts) {
    voucher(br, glNum, date, type, lines, 'Post', 'F', opts);
  }

  // Purchases PI01 (branch 01: 1..12, branch 02: 1..6) — inbound
  for (const [br, n, store] of [['01', 12, 'ST01'], ['02', 6, 'ST02']]) {
    for (let k = 1; k <= n; k += 1) {
      const sup = suppliers[(k + (br === '02' ? 3 : 0)) % suppliers.length];
      const a = items[(k * 2) % 12];
      const b = items[(k * 2 + 1) % 12];
      const lines = [
        { item: a.code, unit: 'PCS', qty1: 40 + k, qty2: 40 + k, price: a.price * 0.6, cost: a.price * 0.6 },
        { item: b.code, unit: 'PCS', qty1: 30 + k, qty2: 30 + k, price: b.price * 0.6, cost: b.price * 0.6 },
      ];
      if (br === '01' && k === 12) lines.push({ item: 'I013', unit: 'PCS', qty1: 4, qty2: 4, price: 6, cost: 6 });
      if (a.box && k % 3 === 0) lines.push({ item: a.code, unit: 'BOX', qty1: 24, qty2: 2, price: a.price * 0.6 * 12, cost: a.price * 0.6 });
      const date = d(1 + (k % 3), k);
      const { glNum, total } = invoice({ br, type: 'PI01', num: k, date, partyAcc: sup.AccountCode, store, lines });
      for (const l of lines) bump(store, l.item, l.qty1);
      glFor(br, glNum, date, 'PI01', [['1010301', total, 0], [sup.AccountCode, 0, total]]);
    }
  }
  // Sales SI01 (branch 01: 1..20, branch 02: 1..8) — outbound, within stock
  const sales = [];
  for (const [br, n, store] of [['01', 20, 'ST01'], ['02', 8, 'ST02']]) {
    for (let k = 1; k <= n; k += 1) {
      const cust = customers[(k * 7 + (br === '02' ? 11 : 0)) % customers.length];
      const lines = [];
      for (const it of items) {
        if (lines.length >= 2) break;
        const have = stock.get(`${store}|${it.code}`) ?? 0;
        if (have >= 15 && (it.code.charCodeAt(3) + k) % 3 === 0) {
          const useBox = it.box && have >= 30 && k % 4 === 0;
          lines.push(useBox
            ? { item: it.code, unit: 'BOX', qty1: 12, qty2: 1, price: it.price * 12 }
            : { item: it.code, unit: 'PCS', qty1: 3 + (k % 5), qty2: 3 + (k % 5), price: it.price });
        }
      }
      if (!lines.length) {
        const it = items.find((x) => (stock.get(`${store}|${x.code}`) ?? 0) >= 5);
        lines.push({ item: it.code, unit: 'PCS', qty1: 2, qty2: 2, price: it.price });
      }
      const date = d(4 + (k % 6), 1 + (k % 27));
      const { glNum, total, h } = invoice({ br, type: 'SI01', num: k, date, partyAcc: cust.AccountCode, store, lines });
      for (const l of lines) bump(store, l.item, -l.qty1);
      glFor(br, glNum, date, 'SI01', [[cust.AccountCode, total, 0], ['4010101', 0, total]]);
      sales.push({ br, num: k, cust, total, h, lines, store });
    }
  }
  // Sales returns SR01 1..3 (same numbers as SI01 1..3 in branch 01) — inbound
  for (let k = 1; k <= 3; k += 1) {
    const s = sales.find((x) => x.br === '01' && x.num === k);
    const l = s.lines[0];
    const q = l.unit === 'BOX' ? { qty1: 12, qty2: 1 } : { qty1: 1, qty2: 1 };
    const lines = [{ item: l.item, unit: l.unit, ...q, price: l.price }];
    const date = d(11, k);
    const { glNum, total } = invoice({ br: '01', type: 'SR01', num: k, date, partyAcc: s.cust.AccountCode, store: 'ST01', lines, ret: { type: 'SI01', num: k } });
    bump('ST01', l.item, q.qty1);
    glFor('01', glNum, date, 'SR01', [['4010101', total, 0], [s.cust.AccountCode, 0, total]]);
  }
  // Purchase returns PR01 1..2 (same numbers as SR01 1..2 → both 'return' family) — outbound
  for (let k = 1; k <= 2; k += 1) {
    const p = invoices.get(`01|PI01|${k}`);
    const det = invD.find((x) => x.BranchCode === '01' && x.Type === 'PI01' && x.InvoiceNum === String(k));
    const lines = [{ item: det.ItemCode, unit: 'PCS', qty1: 2, qty2: 2, price: det.Price }];
    const date = d(11, 10 + k);
    const supAcc = p.h.SupplierAccountCode;
    const { glNum, total } = invoice({ br: '01', type: 'PR01', num: k, date, partyAcc: supAcc, store: 'ST01', lines, ret: { type: 'PI01', num: k } });
    bump('ST01', det.ItemCode, -2);
    glFor('01', glNum, date, 'PR01', [[supAcc, total, 0], ['1010301', 0, total]]);
  }
  // Not posted / cancelled invoices: imported as shells, never in GL or stock
  invoice({ br: '01', type: 'SI01', num: 21, date: d(12, 1), partyAcc: customers[0].AccountCode, store: 'ST01', status: 'UnPost', lines: [{ item: 'I001', unit: 'PCS', qty1: 1, qty2: 1, price: 25 }] });
  invoice({ br: '01', type: 'SI01', num: 22, date: d(12, 2), partyAcc: customers[1].AccountCode, store: 'ST01', deleted: 'T', lines: [{ item: 'I002', unit: 'PCS', qty1: 1, qty2: 1, price: 30 }] });

  // ---- cash vouchers + allocations ---------------------------------------------------
  const cashH = [];
  const cashD = [];
  function cash({ br, type, num, date, boxAcc, lines, currency = 'EGP', change = 1 }) {
    const amount = lines.reduce((a, l) => a + l.amount, 0);
    const glNum = nextGl(br);
    cashH.push({
      CompanyCode: CC, BranchCode: br, YearID: Y, CashNum: String(num), DescA: `سند ${type} ${num}`, Type: type, Date: date,
      Status: 'Post', Deleted: 'F', CurrencyCode: currency, AccountNo: boxAcc, Amount: amount, DetailsAmount: amount,
      OtherSidesAmount: 0, GLNum: String(glNum).padStart(8, '0'),
    });
    lines.forEach((l, i) => cashD.push({
      CompanyCode: CC, BranchCode: br, YearID: Y, CashNum: String(num), DetailNum: i + 1, Type: type, AccountNo: l.acc,
      CCenterCode: null, Amount: l.amount, DetailDescA: `بيان ${i + 1}`, CurrencyCode: currency, Change: change, Accepted: 'T',
      InvoiceType: l.inv?.type ?? null, InvoiceYearId: l.inv ? Y : null, InvoiceNum: l.inv ? String(l.inv.num) : null,
    }));
    const receipt = type.startsWith('KR') || type.startsWith('BR');
    const gl = receipt
      ? [[boxAcc, amount, 0], ...lines.map((l) => [l.acc, 0, l.amount])]
      : [...lines.map((l) => [l.acc, l.amount, 0]), [boxAcc, 0, amount]];
    voucher(br, glNum, date, type, gl, 'Post', 'F', { currency, change });
  }
  const paidBy = new Map();
  const alloc = (key, amount) => paidBy.set(key, (paidBy.get(key) ?? 0) + amount);
  // KR01 1..10 in branch 01 settle SI01 1..10 (fully for even, half for odd)
  for (let k = 1; k <= 10; k += 1) {
    const s = sales.find((x) => x.br === '01' && x.num === k);
    const amt = k % 2 === 0 ? s.total : Math.round(s.total * 50) / 100;
    const lines = k === 10
      ? [{ acc: s.cust.AccountCode, amount: Math.round(amt * 50) / 100, inv: { type: 'SI01', num: k } },
         { acc: s.cust.AccountCode, amount: amt - Math.round(amt * 50) / 100, inv: { type: 'SI01', num: k } }]
      : [{ acc: s.cust.AccountCode, amount: amt, inv: { type: 'SI01', num: k } }];
    if (k === 10) lines[1].amount = lines[0].amount; // identical twin allocation lines (same cash, invoice, amount)
    cash({ br: '01', type: 'KR01', num: k, date: d(10, k), boxAcc: '1010101', lines });
    for (const l of lines) alloc(`01|SI01|${k}`, l.amount);
  }
  // KR01 11: on-account receipt (no invoice)
  cash({ br: '01', type: 'KR01', num: 11, date: d(10, 15), boxAcc: '1010101', lines: [{ acc: customers[5].AccountCode, amount: 500 }] });
  // BR01 1..3: bank receipts with the SAME numbers as KR01 1..3 (both RECEIPT)
  for (let k = 1; k <= 3; k += 1) {
    const s = sales.find((x) => x.br === '01' && x.num === 10 + k);
    cash({ br: '01', type: 'BR01', num: k, date: d(10, 20 + k), boxAcc: '1010102', lines: [{ acc: s.cust.AccountCode, amount: s.total, inv: { type: 'SI01', num: s.num } }] });
    alloc(`01|SI01|${s.num}`, s.total);
  }
  // Branch 02 KR01 1..3 (same numbers as branch 01)
  for (let k = 1; k <= 3; k += 1) {
    const s = sales.find((x) => x.br === '02' && x.num === k);
    cash({ br: '02', type: 'KR01', num: k, date: d(10, k), boxAcc: '1010101', lines: [{ acc: s.cust.AccountCode, amount: s.total, inv: { type: 'SI01', num: k } }] });
    alloc(`02|SI01|${k}`, s.total);
  }
  // KP01 1..4: supplier payments settling PI01 1..4
  for (let k = 1; k <= 4; k += 1) {
    const p = invoices.get(`01|PI01|${k}`);
    cash({ br: '01', type: 'KP01', num: k, date: d(9, k), boxAcc: '1010101', lines: [{ acc: p.h.SupplierAccountCode, amount: p.total, inv: { type: 'PI01', num: k } }] });
    alloc(`01|PI01|${k}`, p.total);
  }
  // ---- closed year 2025: same journal / invoice numbers as 2026 -------------------------
  for (let k = 1; k <= 5; k += 1) {
    voucher('01', nextGl('01', '2025'), `2025-0${k}-10`, 'GL01', [['5010102', 1000 + k, 0, 'CC01'], ['1010101', 0, 1000 + k]], 'Post', 'F', { year: '2025' });
  }
  {
    const sup = suppliers[0];
    const it = items[5];
    const pl = [{ item: it.code, unit: 'PCS', qty1: 10, qty2: 10, price: it.price * 0.6, cost: it.price * 0.6 }];
    const p = invoice({ br: '01', type: 'PI01', num: 1, date: '2025-11-01', partyAcc: sup.AccountCode, store: 'ST01', lines: pl, year: '2025' });
    bump('ST01', it.code, 10);
    voucher('01', p.glNum, '2025-11-01', 'PI01', [['1010301', p.total, 0], [sup.AccountCode, 0, p.total]], 'Post', 'F', { year: '2025' });
    const cust = customers[9];
    const sl = [{ item: it.code, unit: 'PCS', qty1: 4, qty2: 4, price: it.price }];
    const si = invoice({ br: '01', type: 'SI01', num: 1, date: '2025-12-01', partyAcc: cust.AccountCode, store: 'ST01', lines: sl, year: '2025' });
    bump('ST01', it.code, -4);
    voucher('01', si.glNum, '2025-12-01', 'SI01', [[cust.AccountCode, si.total, 0], ['4010101', 0, si.total]], 'Post', 'F', { year: '2025' });
  }
  // ---- foreign currency: USD sale + partial USD receipt ---------------------------------
  {
    const cust = customers[12];
    const it = items[7];
    const ul = [{ item: it.code, unit: 'PCS', qty1: 2, qty2: 2, price: 50 }];
    const u = invoice({ br: '01', type: 'SI01', num: 23, date: d(12, 5), partyAcc: cust.AccountCode, store: 'ST01', lines: ul, currency: 'USD', change: 48 });
    bump('ST01', it.code, -2);
    glFor('01', u.glNum, d(12, 5), 'SI01', [[cust.AccountCode, u.total, 0], ['4010101', 0, u.total]], { currency: 'USD', change: 48 });
    cash({ br: '01', type: 'KR01', num: 12, date: d(12, 6), boxAcc: '1010102', currency: 'USD', change: 48,
      lines: [{ acc: cust.AccountCode, amount: 40, inv: { type: 'SI01', num: 23 } }] });
    alloc('01|SI01|23', 40);
  }

  for (const [key, amount] of paidBy) {
    const inv = invoices.get(key);
    inv.h.PaidAmount = Math.round(amount * 100) / 100;
  }

  // ---- cheques -----------------------------------------------------------------------
  const ck = [];
  const pk = [];
  const custCode = (acc) => customers.find((c) => c.AccountCode === acc).CustomerCode;
  function inwardCheque({ br, ckNum, id, idNum, cust, amount, take }) {
    const glNum = nextGl(br);
    const date = d(8, Number(id) + 1);
    voucher(br, glNum, date, 'CK01', [['1010401', amount, 0], [cust.AccountCode, 0, amount]]);
    let takeGl = null;
    if (take) {
      takeGl = nextGl(br);
      voucher(br, takeGl, d(9, 20), 'CK01', [['1010102', amount, 0], ['1010401', 0, amount]]);
    }
    ck.push({
      CompanyCode: CC, BranchCode: br, YearID: Y, CKNum: String(ckNum), Type: 'CK01', AccountNo: '1010401',
      FromAccountNo: cust.AccountCode, CurrencyCode: 'EGP', Change: 1, Amount: amount, Name: take ? 'البنك الأهلي' : 'بنك مصر',
      GehaCode: custCode(cust.AccountCode), EditDate: date, EditGLNum: String(glNum).padStart(8, '0'),
      TakeDate: d(9, 15), TakeGLNum: takeGl ? String(takeGl).padStart(8, '0') : null, IsTake: take ? 'T' : 'F',
      IsTazher: 'F', IsReturn: 'F', IsBank: 'F', Status: 'Post', Deleted: 'F', DetailDescA: `شيك ${idNum}`,
      Id: id, IdNum: idNum,
    });
  }
  inwardCheque({ br: '01', ckNum: 1, id: 1, idNum: '100001', cust: customers[2], amount: 1500 });
  inwardCheque({ br: '01', ckNum: 1, id: 2, idNum: '100002', cust: customers[2], amount: 2500, take: true });
  inwardCheque({ br: '01', ckNum: 2, id: 1, idNum: '100003', cust: customers[3], amount: 900 });
  // Same paper number as branch 01 cheque 100001 (another customer, another bank)
  inwardCheque({ br: '02', ckNum: 1, id: 1, idNum: '100001', cust: customers[4], amount: 1200 });
  // Outward cheques to suppliers
  for (const [num, sup, amount] of [[1, suppliers[1], 3000], [2, suppliers[2], 1750]]) {
    const glNum = nextGl('01');
    const date = d(9, 5 + num);
    voucher('01', glNum, date, 'PK01', [[sup.AccountCode, amount, 0], ['2010201', 0, amount]]);
    pk.push({
      CompanyCode: CC, BranchCode: '01', YearID: Y, PKNum: String(num), Type: 'PK01', AccountNo: '2010201',
      CurrencyCode: 'EGP', Change: 1, Amount: amount, Name: 'البنك الأهلي', GehaCode: sup.SupplierCode,
      EditDate: date, EditGLNum: String(glNum).padStart(8, '0'), IsTake: 'F', IsTazher: 'F', IsReturn: 'F',
      Status: 'Post', Deleted: 'F', DetailDescA: `شيك صادر ${num}`, IdNum: `20000${num}`,
    });
  }

  // ---- stock transfer + stocktake (no GL) ---------------------------------------------
  const stH = [];
  const stD = [];
  for (let k = 1; k <= 2; k += 1) {
    const it = items.find((x) => (stock.get(`ST01|${x.code}`) ?? 0) >= 20 && x.code.endsWith(String(k)));
    const qty = 5 * k;
    stH.push({ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreTransCode: String(k), DescA: `تحويل ${k}`, Type: 'ST01', Date: d(11, 20 + k), Deleted: 'F', FromStoreCode: 'ST01', ToStoreCode: 'ST02', Status: 'Post' });
    stD.push({ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreTransCode: String(k), Type: 'ST01', ItemCode: it.code, Qty: qty, TransQty: qty, UnitCode: 'PCS', Price: it.price * 0.6, TotalPrice: qty * it.price * 0.6, Change: 1, TransMainQty: qty, RowNum: 1 });
    bump('ST01', it.code, -qty);
    bump('ST02', it.code, qty);
  }
  // Stocktake: one item found 3 short in ST01 (StoreCheck + matching StoreAdjust, as legacy does)
  const tk = items.find((x) => (stock.get(`ST01|${x.code}`) ?? 0) >= 10);
  const book = stock.get(`ST01|${tk.code}`);
  await insert('StoreCheckHeader', [{ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreCheckCode: '1', DescA: 'جرد', Type: 'SK01', Date: d(12, 15), Deleted: 'F', StoreCode: 'ST01', Status: 'Post', Performed: 'T' }]);
  await insert('StoreCheckDetail', [{ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreCheckCode: '1', ItemCode: tk.code, Qty: book, ActualQty: book - 3, UnitCode: 'PCS', Price: tk.price * 0.6, ItemAddQty: 0, ItemRemoveQty: 3 }]);
  await insert('StoreAdjustHeader', [{ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreCheckCode: '1', DescA: 'تسوية جرد', Type: 'SA01', Date: d(12, 15), Deleted: 'F', StoreCode: 'ST01', Status: 'Post', Performed: 'T' }]);
  await insert('StoreAdjustDetail', [{ CompanyCode: CC, BranchCode: '01', YearID: Y, StoreCheckCode: '1', ItemCode: tk.code, Qty: book, ActualQty: book - 3, UnitCode: 'PCS', Price: tk.price * 0.6, ItemAddQty: 0, ItemRemoveQty: 3 }]);
  bump('ST01', tk.code, -3);

  if (process.env.DIRTY === '1') {
    // Deliberately broken rows: the preflight must name each one.
    voucher('01', 900, d(12, 20), 'GL01', [['5010101', 100, 0], ['1010101', 0, 90]]); // unbalanced
    await insert('GLTrxDetail', [{ CompanyCode: CC, BranchCode: '01', YearID: Y, GLNum: '999', DetailNum: 1, Type: 'GL01', AccountNo: '5010101', DebitValue: 5, CreditValue: 0, CurrencyCode: 'EGP', Change: 1 }]);
    const c0 = customers[0];
    const x = invoice({ br: '01', type: 'SI01', num: 24, date: d(12, 21), partyAcc: c0.AccountCode, store: 'ST01', lines: [{ item: 'X999', unit: 'PCS', qty1: 1, qty2: 1, price: 10 }] });
    glFor('01', x.glNum, d(12, 21), 'SI01', [[c0.AccountCode, x.total, 0], ['4010101', 0, x.total]]);
    const y = invoice({ br: '01', type: 'SI01', num: 25, date: d(12, 22), partyAcc: c0.AccountCode, store: 'ST01', lines: [{ item: 'I009', unit: 'DOZ', qty1: 12, qty2: 1, price: 300 }] });
    glFor('01', y.glNum, d(12, 22), 'SI01', [[c0.AccountCode, y.total, 0], ['4010101', 0, y.total]]);
    const z = invoice({ br: '01', type: 'SI01', num: 26, date: d(12, 23), partyAcc: c0.AccountCode, store: 'ST09', lines: [{ item: 'I010', unit: 'PCS', qty1: 1, qty2: 1, price: 70 }] });
    glFor('01', z.glNum, d(12, 23), 'SI01', [[c0.AccountCode, z.total, 0], ['4010101', 0, z.total]]);
    const w = invoice({ br: '01', type: 'SI01', num: 27, date: d(12, 24), partyAcc: c0.AccountCode, store: 'ST01', lines: [{ item: 'I011', unit: 'PCS', qty1: 1, qty2: 1, price: 75 }] });
    w.h.GLNum = null; // posted without a journal
    cash({ br: '01', type: 'KR01', num: 13, date: d(12, 25), boxAcc: '1010101', lines: [{ acc: c0.AccountCode, amount: 15, inv: { type: 'SI01', num: 99 } }] });
    ck.push({ CompanyCode: CC, BranchCode: '01', YearID: Y, CKNum: '9', Type: 'CK01', AccountNo: '1010401', Amount: 0, Status: 'Post', Deleted: 'F', Id: 1, IdNum: '777777' });
    await insert('Supplier', [{ CompanyCode: CC, SupplierCode: '11', BranchCode: '01', SupplierNameA: 'مورد يشارك حساب عميل', AccountCode: customers[29].AccountCode, CurrencyCode: 'EGP' }]);
  }

  await insert('InvoiceTrxHeader', invH);
  await insert('InvoiceTrxDetail', invD);
  await insert('CashTrxHeader', cashH);
  await insert('CashTrxDetail', cashD);
  await insert('CKTrxDetail', ck);
  await insert('PKTrxDetail', pk);
  await insert('StoreTransHeader', stH);
  await insert('StoreTransDetail', stD);
  await insert('ItemStore', [...stock].map(([k, q]) => {
    const [store, item] = k.split('|');
    return { CompanyCode: CC, ItemCode: item, StoreCode: store, Qty: q };
  }));

  Object.assign(EXPECT, {
    items: items.length, itemGroups: 2,
    invoices: { posted: invH.filter((h) => h.Status === 'Post' && h.Deleted !== 'T').length, draft: 1, cancelled: 1, lines: invD.length },
    cash: { vouchers: cashH.length, lines: cashD.length, allocations: cashD.filter((x) => x.InvoiceNum).length },
    cheques: { inward: ck.length, outward: pk.length },
    stockByStoreItem: Object.fromEntries(stock),
  });
  console.error('OPS', JSON.stringify(EXPECT));
}
