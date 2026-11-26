const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const camel = (v) =>
  Array.isArray(v)
    ? v.map(camel)
    : v && typeof v === "object"
    ? Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k.charAt(0).toLowerCase() + k.slice(1), camel(x)])
      )
    : v;

const json = (data, status = 200) =>
  new Response(JSON.stringify(camel(data)), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;
const makeNumber = (prefix) => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
  return `${prefix}-${d}-${r}`;
};

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError("Invalid JSON body");
  }
}

// Accepts different field names the website might send.
function normalizeCustomer(raw) {
  const c = raw || {};
  return {
    name: c.name ?? c.fullName ?? c.customerName ?? null,
    email: c.email ?? null,
    phone: c.phone ?? c.customerPhone ?? c.phoneNumber ?? c.mobile ?? null,
    address: c.address ?? c.siteAddress ?? null,
    postalCode: c.postalCode ?? c.pin ?? c.pincode ?? c.zip ?? null,
  };
}

function normalizeItems(body) {
  const list = body.items ?? body.cartItems ?? body.lines ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((i) => ({
    productId: i.productId ?? i.id ?? i.product?.id,
    sku: i.sku ?? i.product?.sku,
    quantity: i.quantity ?? i.qty,
  }));
}

// Find the customer by phone, or create a new one. Returns the customer Id.
async function upsertCustomer(env, raw) {
  const c = normalizeCustomer(raw);
  if (!c.name || !c.phone) throw new HttpError("Customer name and phone are required");
  const existing = await env.DB.prepare("SELECT Id FROM Customers WHERE Phone = ?")
    .bind(String(c.phone)).first();
  if (existing) return existing.Id;
  const res = await env.DB.prepare(
    "INSERT INTO Customers (Name, Email, Phone, Address, PostalCode) VALUES (?, ?, ?, ?, ?)"
  ).bind(c.name, c.email, String(c.phone), c.address, c.postalCode).run();
  return res.meta.last_row_id;
}

// Prices always come from the Products table, never from the browser.
// Items are matched by numeric Id or by Sku.
async function priceItems(env, items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError("At least one item is required");
  const { results } = await env.DB.prepare(
    "SELECT Id, Sku, UnitPrice FROM Products WHERE IsActive = 1"
  ).all();
  const byId = new Map(results.map((p) => [String(p.Id), p]));
  const bySku = new Map(results.map((p) => [String(p.Sku).toLowerCase(), p]));

  let subtotal = 0;
  const lines = items.map((i) => {
    const product =
      byId.get(String(i.productId)) ||
      bySku.get(String(i.sku ?? i.productId ?? "").toLowerCase());
    if (!product) throw new HttpError(`Product not found: ${i.sku ?? i.productId}`);
    const quantity = Number(i.quantity);
    if (!(quantity > 0 && quantity <= 100000)) throw new HttpError("Invalid quantity");
    subtotal += quantity * product.UnitPrice;
    return { productId: product.Id, quantity, unitPrice: product.UnitPrice };
  });
  return { lines, subtotal: round2(subtotal) };
}

function totals(subtotal, taxRateInput) {
  const taxRate = taxRateInput === undefined || taxRateInput === null ? 0.18 : Number(taxRateInput);
  if (!(taxRate >= 0 && taxRate <= 1)) throw new HttpError("taxRate must be between 0 and 1");
  const taxAmount = round2(subtotal * taxRate);
  return { taxRate, taxAmount, total: round2(subtotal + taxAmount) };
}

// Creates the order and its items. Returns the order summary.
async function createOrder(env, customerRaw, items, taxRateInput, notes) {
  const customerId = await upsertCustomer(env, customerRaw);
  const { lines, subtotal } = await priceItems(env, items);
  const t = totals(subtotal, taxRateInput);
  const orderNumber = makeNumber("ORD");

  const stmts = [
    env.DB.prepare(
      `INSERT INTO Orders (OrderNumber, CustomerId, Subtotal, TaxRate, TaxAmount, Total, Notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(orderNumber, customerId, subtotal, t.taxRate, t.taxAmount, t.total, notes ?? null),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO OrderItems (OrderId, ProductId, Quantity, UnitPriceAtOrder)
         VALUES ((SELECT Id FROM Orders WHERE OrderNumber = ?), ?, ?, ?)`
      ).bind(orderNumber, l.productId, l.quantity, l.unitPrice)
    ),
  ];
  await env.DB.batch(stmts);
  return { ok: true, orderNumber, customerId, subtotal, ...t };
}

// Order total, amount paid so far (only Paid payments count) and amount still due.
async function loadOrderSummary(env, orderNumber) {
  const o = await env.DB.prepare(
    "SELECT Id, OrderNumber, Total FROM Orders WHERE OrderNumber = ?"
  ).bind(String(orderNumber)).first();
  if (!o) throw new HttpError("Order not found", 404);
  const p = await env.DB.prepare(
    "SELECT COALESCE(SUM(Amount), 0) AS paid FROM Payments WHERE OrderId = ? AND Status = 'Paid'"
  ).bind(o.Id).first();
  const paidAmount = round2(p.paid);
  return {
    id: o.Id,
    orderNumber: o.OrderNumber,
    total: o.Total,
    paidAmount,
    amountDue: round2(o.Total - paidAmount),
  };
}

function paymentJson(row, orderNumber) {
  return {
    id: row.Id,
    orderNumber,
    amount: row.Amount,
    paymentType: row.PaymentType,
    status: row.Status,
    transactionReference: row.TransactionReference,
  };
}

async function loadPayment(env, id) {
  const row = await env.DB.prepare(
    `SELECT p.Id, p.Amount, p.PaymentType, p.Status, p.TransactionReference, o.OrderNumber
     FROM Payments p JOIN Orders o ON o.Id = p.OrderId WHERE p.Id = ?`
  ).bind(id).first();
  if (!row) throw new HttpError("Payment not found", 404);
  return paymentJson(row, row.OrderNumber);
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const lp = path.toLowerCase();
  const method = request.method;

  if (lp === "/api/health") {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM ProductImages").first();
    return json({ ok: true, productImages: r.n });
  }

  // ---- Catalog ----
  if (lp === "/api/categories" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT Id, Name, Description, IsActive FROM Categories ORDER BY Id"
    ).all();
    return json(results.map((r) => ({
      id: r.Id, name: r.Name, description: r.Description, isActive: r.IsActive === 1,
    })));
  }

  if (lp === "/api/products" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT p.Id, p.Sku, p.Name, p.Description, p.Specification, p.UnitPrice,
              p.UnitOfMeasure, p.CategoryId, p.IsActive, c.Name AS CategoryName
       FROM Products p JOIN Categories c ON c.Id = p.CategoryId
       ORDER BY p.Id`
    ).all();
    return json(results.map((r) => ({
      id: r.Id, sku: r.Sku, name: r.Name, description: r.Description,
      specification: r.Specification, spec: r.Specification,
      unitPrice: r.UnitPrice, rate: r.UnitPrice,
      unitOfMeasure: r.UnitOfMeasure, categoryId: r.CategoryId,
      categoryName: r.CategoryName, isActive: r.IsActive === 1,
    })));
  }

  if (lp === "/api/product-images" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT Id, Image, Thickness, SizeLabel, ImageUrl, SortOrder, IsActive FROM ProductImages WHERE IsActive = 1 ORDER BY SortOrder"
    ).all();
    return json(results.map((r) => ({
      id: r.Id, image: r.Image, thickness: r.Thickness, sizeLabel: r.SizeLabel,
      imageUrl: r.ImageUrl, sortOrder: r.SortOrder, isActive: r.IsActive === 1,
    })));
  }

  // ---- Customer sign-up (website calls customer-signup) ----
  if ((lp === "/api/customer-signup" || lp === "/api/customers/signup") && method === "POST") {
    const body = await readBody(request);
    const customerId = await upsertCustomer(env, body);
    const c = normalizeCustomer(body);
    return json({
      ok: true, id: customerId, customerId,
      name: c.name, email: c.email, phone: String(c.phone),
    }, 201);
  }

  // ---- Customer registration ----
  if (lp === "/api/customers" && method === "POST") {
    const body = await readBody(request);
    const id = await upsertCustomer(env, body);
    return json({ ok: true, customerId: id }, 201);
  }

  // ---- Checkout: creates the order (website calls payments/checkout) ----
  if (lp === "/api/payments/checkout" && method === "POST") {
    const body = await readBody(request);
    const result = await createOrder(
      env,
      body.customer ?? body,
      normalizeItems(body),
      body.taxRate,
      body.notes
    );
    return json({
      ...result,
      paidAmount: 0,
      amountDue: result.total,
      paymentStatus: "Pending",
    }, 201);
  }

  // ---- Payment dialog: load an order with paid / due amounts ----
  const payOrderMatch = path.match(/^\/api\/payments\/orders\/([\w-]+)$/i);
  if (payOrderMatch && method === "GET") {
    return json(await loadOrderSummary(env, payOrderMatch[1].toUpperCase()));
  }

  // ---- Payment dialog: create a payment request ----
  if (lp === "/api/payments/intents" && method === "POST") {
    const body = await readBody(request);
    const summary = await loadOrderSummary(env, String(body.orderNumber || "").toUpperCase());
    if (summary.amountDue <= 0) throw new HttpError("No balance is due for this order");
    const paymentType = body.paymentType || "FullPayment";
    const reference = makeNumber("PAY");
    const res = await env.DB.prepare(
      `INSERT INTO Payments (OrderId, Amount, Method, PaymentType, Status, TransactionReference)
       VALUES (?, ?, ?, ?, 'Pending', ?)`
    ).bind(summary.id, summary.amountDue, body.method || "Online", paymentType, reference).run();
    return json(await loadPayment(env, res.meta.last_row_id), 201);
  }

  // ---- Payment dialog: mark as Processing / check status ----
  const payIdMatch = lp.match(/^\/api\/payments\/(\d+)\/(processing|status)$/);
  if (payIdMatch) {
    const id = Number(payIdMatch[1]);
    if (payIdMatch[2] === "processing" && (method === "POST" || method === "PUT")) {
      await env.DB.prepare(
        "UPDATE Payments SET Status = 'Processing', UpdatedAtUtc = CURRENT_TIMESTAMP WHERE Id = ? AND Status = 'Pending'"
      ).bind(id).run();
      return json(await loadPayment(env, id));
    }
    if (payIdMatch[2] === "status" && method === "GET") {
      return json(await loadPayment(env, id));
    }
  }

  // ---- Place an order ----
  if (lp === "/api/orders" && method === "POST") {
    const body = await readBody(request);
    const result = await createOrder(
      env, body.customer ?? body, normalizeItems(body), body.taxRate, body.notes
    );
    return json(result, 201);
  }

  // ---- Look up an order by its number ----
  const orderMatch = path.match(/^\/api\/orders\/([\w-]+)$/i);
  if (orderMatch && method === "GET") {
    const order = await env.DB.prepare(
      `SELECT o.*, c.Name AS CustomerName, c.Phone AS CustomerPhone
       FROM Orders o JOIN Customers c ON c.Id = o.CustomerId WHERE o.OrderNumber = ?`
    ).bind(orderMatch[1].toUpperCase()).first();
    if (!order) throw new HttpError("Order not found", 404);
    const { results } = await env.DB.prepare(
      `SELECT oi.ProductId, p.Name, oi.Quantity, oi.UnitPriceAtOrder, oi.LineTotal
       FROM OrderItems oi JOIN Products p ON p.Id = oi.ProductId WHERE oi.OrderId = ?`
    ).bind(order.Id).all();
    return json({ ...order, items: results });
  }

  // ---- Create a quotation (totals only, no line items table yet) ----
  if (lp === "/api/quotations" && method === "POST") {
    const body = await readBody(request);
    const customerId = await upsertCustomer(env, body.customer ?? body);
    const { subtotal } = await priceItems(env, normalizeItems(body));
    const t = totals(subtotal, body.taxRate);
    const quoteNumber = makeNumber("QUO");
    const validUntil = new Date(Date.now() + 15 * 86400000).toISOString();
    await env.DB.prepare(
      `INSERT INTO Quotations (QuoteNumber, CustomerId, Status, Subtotal, TaxRate, TaxAmount, Total, ValidUntilUtc)
       VALUES (?, ?, 'Draft', ?, ?, ?, ?, ?)`
    ).bind(quoteNumber, customerId, subtotal, t.taxRate, t.taxAmount, t.total, validUntil).run();
    return json({ ok: true, quoteNumber, customerId, subtotal, ...t, validUntilUtc: validUntil }, 201);
  }

  // ---- Sync (used only by your laptop, needs the secret password) ----
  if (lp.startsWith("/api/sync/")) {
    const auth = request.headers.get("Authorization") || "";
    if (!env.SYNC_TOKEN || auth !== `Bearer ${env.SYNC_TOKEN}`) {
      throw new HttpError("Unauthorized", 401);
    }

    if (lp === "/api/sync/pending" && method === "GET") {
      const customers = await env.DB.prepare(
        "SELECT Id, Name, Email, Phone, Address, PostalCode, CreatedAtUtc FROM Customers WHERE SyncedAtUtc IS NULL"
      ).all();
      const orders = await env.DB.prepare(
        `SELECT o.Id, o.OrderNumber, o.Status, o.Subtotal, o.TaxRate, o.TaxAmount, o.Total,
                o.Notes, o.CreatedAtUtc, c.Phone AS CustomerPhone
         FROM Orders o JOIN Customers c ON c.Id = o.CustomerId WHERE o.SyncedAtUtc IS NULL`
      ).all();
      const items = await env.DB.prepare(
        `SELECT o.OrderNumber, p.Sku, oi.ProductId, oi.Quantity, oi.UnitPriceAtOrder, oi.LineTotal
         FROM OrderItems oi
         JOIN Orders o ON o.Id = oi.OrderId
         JOIN Products p ON p.Id = oi.ProductId
         WHERE o.SyncedAtUtc IS NULL`
      ).all();
      const quotations = await env.DB.prepare(
        `SELECT q.Id, q.QuoteNumber, q.Status, q.Subtotal, q.TaxRate, q.TaxAmount, q.Total,
                q.ValidUntilUtc, q.CreatedAtUtc, c.Phone AS CustomerPhone
         FROM Quotations q JOIN Customers c ON c.Id = q.CustomerId WHERE q.SyncedAtUtc IS NULL`
      ).all();
      // Catalog, images, admin users and payments are small, so they are sent in full every time.
      // The laptop script adds what is missing and updates what changed.
      const categories = await env.DB.prepare(
        "SELECT Name, Description, IsActive FROM Categories"
      ).all();
      const products = await env.DB.prepare(
        `SELECT p.Sku, p.Name, p.Description, p.Specification, p.UnitPrice, p.UnitOfMeasure,
                p.IsActive, c.Name AS CategoryName
         FROM Products p JOIN Categories c ON c.Id = p.CategoryId`
      ).all();
      const productImages = await env.DB.prepare("SELECT * FROM ProductImages").all();
      const adminUsers = await env.DB.prepare("SELECT * FROM AdminUsers").all();
      const payments = await env.DB.prepare(
        `SELECT p.*, o.OrderNumber, c.Name AS CustomerName
         FROM Payments p
         JOIN Orders o ON o.Id = p.OrderId
         JOIN Customers c ON c.Id = o.CustomerId`
      ).all();
      return json({
        customers: customers.results,
        orders: orders.results,
        items: items.results,
        quotations: quotations.results,
        categories: categories.results,
        products: products.results,
        productImages: productImages.results,
        adminUsers: adminUsers.results,
        payments: payments.results,
      });
    }

    if (lp === "/api/sync/done" && method === "POST") {
      const b = await readBody(request);
      const ids = (a) => (Array.isArray(a) ? a : []).map(Number).filter(Number.isInteger);
      const mark = (table, list) =>
        ids(list).map((id) =>
          env.DB.prepare(`UPDATE ${table} SET SyncedAtUtc = CURRENT_TIMESTAMP WHERE Id = ?`).bind(id)
        );
      const stmts = [
        ...mark("Customers", b.customerIds),
        ...mark("Orders", b.orderIds),
        ...mark("Quotations", b.quotationIds),
      ];
      if (stmts.length) await env.DB.batch(stmts);
      return json({ ok: true, marked: stmts.length });
    }
  }

  throw new HttpError("Not found", 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Server error" }, 500);
    }
  },
};