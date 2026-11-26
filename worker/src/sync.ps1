$api = "https://buildkart-api.saas-agency2021.workers.dev"
$token = (Get-Content "$PSScriptRoot\sync.token" -Raw).Trim()
$connStr = "Server=localhost;Database=BuildKartDB;Integrated Security=True;TrustServerCertificate=True"

function Dto($v) {
  if ($null -eq $v -or "$v" -eq "") { return [DBNull]::Value }
  try {
    return [DateTime]::Parse("$v", [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
  } catch { return [DBNull]::Value }
}
function DbVal($v) { if ($null -eq $v) { return [DBNull]::Value }; return $v }
function Rows($x) { return @($x | Where-Object { $null -ne $_ }) }

$conn = New-Object System.Data.SqlClient.SqlConnection $connStr
$conn.Open()

function Run($sql, $prm = @{}) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $sql
  foreach ($k in $prm.Keys) {
    $val = $prm[$k]
    if ($null -eq $val) { $val = [DBNull]::Value }
    [void]$cmd.Parameters.AddWithValue($k, $val)
  }
  return $cmd.ExecuteScalar()
}

$headers = @{ Authorization = "Bearer $token" }
$data = Invoke-RestMethod -Uri "$api/api/sync/pending" -Headers $headers

$nCust = @(Rows $data.customers).Count; $nOrd = @(Rows $data.orders).Count
$nQuo = @(Rows $data.quotations).Count; $nProd = @(Rows $data.products).Count
$nPay = @(Rows $data.payments).Count; $nImg = @(Rows $data.productImages).Count
$nAdm = @(Rows $data.adminUsers).Count
Write-Host "Found: $nCust customers, $nOrd orders, $nQuo quotations, $nProd products, $nPay payments, $nImg product images, $nAdm admin users"
if ($nImg -eq 0 -and $nAdm -eq 0) {
  Write-Host "Note: Cloudflare sent no product images or admin users. Run 'npx wrangler deploy' in the worker folder." -ForegroundColor Yellow
}

$itemCols = @()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='OrderItems'"
$r = $cmd.ExecuteReader(); while ($r.Read()) { $itemCols += $r[0] }; $r.Close()
$priceCol = if ($itemCols -contains "UnitPriceAtOrder") { "UnitPriceAtOrder" } else { "UnitPrice" }
$lineTotalComputed = Run "SELECT COLUMNPROPERTY(OBJECT_ID('OrderItems'),'LineTotal','IsComputed')"
$hasLineTotal = $itemCols -contains "LineTotal"

$counts = @{ cat = 0; prod = 0; cust = 0; ord = 0; quo = 0; pay = 0; img = 0; adm = 0 }
$doneCust = @(); $doneOrd = @(); $doneQuo = @()

# ---- Categories ----
foreach ($row in (Rows $data.categories)) {
  try {
    $id = Run "SELECT Id FROM Categories WHERE Name=@n" @{ "@n" = $row.name }
    if ($id) {
      [void](Run "UPDATE Categories SET Description=@d, IsActive=@a WHERE Id=@id" @{ "@d" = (DbVal $row.description); "@a" = [int]$row.isActive; "@id" = $id })
    } else {
      [void](Run "INSERT INTO Categories (Name, Description, IsActive, CreatedAtUtc) VALUES (@n,@d,@a,SYSDATETIMEOFFSET())" @{ "@n" = $row.name; "@d" = (DbVal $row.description); "@a" = [int]$row.isActive })
      $counts.cat++
    }
  } catch { Write-Host "Category $($row.name) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

# ---- Products ----
foreach ($row in (Rows $data.products)) {
  try {
    $catId = Run "SELECT Id FROM Categories WHERE Name=@n" @{ "@n" = $row.categoryName }
    if (-not $catId) { throw "Category '$($row.categoryName)' not found" }
    $id = Run "SELECT Id FROM Products WHERE Sku=@s" @{ "@s" = $row.sku }
    $prm = @{ "@s" = $row.sku; "@n" = $row.name; "@d" = "$($row.description)"; "@sp" = "$($row.specification)"; "@u" = [decimal]$row.unitPrice; "@m" = "$($row.unitOfMeasure)"; "@c" = $catId; "@a" = [int]$row.isActive }
    if ($id) {
      $prm["@id"] = $id
      [void](Run "UPDATE Products SET Name=@n, Description=@d, Specification=@sp, UnitPrice=@u, UnitOfMeasure=@m, CategoryId=@c, IsActive=@a WHERE Id=@id" $prm)
    } else {
      [void](Run "INSERT INTO Products (Sku, Name, Description, Specification, UnitPrice, UnitOfMeasure, CategoryId, IsActive, CreatedAtUtc) VALUES (@s,@n,@d,@sp,@u,@m,@c,@a,SYSDATETIMEOFFSET())" $prm)
      $counts.prod++
    }
  } catch { Write-Host "Product $($row.sku) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

# ---- Customers ----
foreach ($row in (Rows $data.customers)) {
  try {
    $phone = "$($row.phone)"
    $name = if ($row.name) { "$($row.name)" } else { $phone }
    $exists = Run "SELECT Id FROM Customers WHERE Phone=@p" @{ "@p" = $phone }
    if (-not $exists) {
      $email = if ($row.email) { "$($row.email)" } else { "$phone@noemail.local" }
      [void](Run "INSERT INTO Customers (Name, Email, Phone, Address, PostalCode, CreatedAtUtc) VALUES (@n,@e,@p,@a,@pc,@cr)" @{
        "@n" = $name; "@e" = $email; "@p" = $phone; "@a" = (DbVal $row.address); "@pc" = (DbVal $row.postalCode); "@cr" = (Dto $row.createdAtUtc) })
      $counts.cust++
    }
    $doneCust += $row.id
  } catch {
    Write-Host "Customer $($row.phone) failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ("  Row was: " + ($row | ConvertTo-Json -Compress)) -ForegroundColor Red
  }
}

# ---- Orders and items ----
foreach ($o in (Rows $data.orders)) {
  $tx = $conn.BeginTransaction()
  try {
    $cmd = $conn.CreateCommand(); $cmd.Transaction = $tx
    $cmd.CommandText = "SELECT Id FROM Orders WHERE OrderNumber=@n"
    [void]$cmd.Parameters.AddWithValue("@n", $o.orderNumber)
    $existing = $cmd.ExecuteScalar()
    if (-not $existing) {
      $cmd = $conn.CreateCommand(); $cmd.Transaction = $tx
      $cmd.CommandText = "SELECT Id FROM Customers WHERE Phone=@p"
      [void]$cmd.Parameters.AddWithValue("@p", "$($o.customerPhone)")
      $custId = $cmd.ExecuteScalar()
      if (-not $custId) { throw "Customer with phone $($o.customerPhone) is not in SQL Server" }

      $cmd = $conn.CreateCommand(); $cmd.Transaction = $tx
      $cmd.CommandText = "INSERT INTO Orders (OrderNumber, CustomerId, Status, Subtotal, TaxRate, TaxAmount, Total, Notes, CreatedAtUtc) OUTPUT INSERTED.Id VALUES (@n,@c,@s,@sub,@tr,@ta,@t,@no,@cr)"
      $pr = @{ "@n" = $o.orderNumber; "@c" = $custId; "@s" = "$($o.status)"; "@sub" = [decimal]$o.subtotal; "@tr" = [decimal]$o.taxRate; "@ta" = [decimal]$o.taxAmount; "@t" = [decimal]$o.total; "@no" = (DbVal $o.notes); "@cr" = (Dto $o.createdAtUtc) }
      foreach ($k in $pr.Keys) { [void]$cmd.Parameters.AddWithValue($k, $pr[$k]) }
      $orderId = $cmd.ExecuteScalar()

      foreach ($i in @(Rows $data.items | Where-Object { $_.orderNumber -eq $o.orderNumber })) {
        $cmd = $conn.CreateCommand(); $cmd.Transaction = $tx
        $cmd.CommandText = "SELECT Id FROM Products WHERE Sku=@s"
        [void]$cmd.Parameters.AddWithValue("@s", $i.sku)
        $prodId = $cmd.ExecuteScalar()
        if (-not $prodId) { throw "Product with SKU $($i.sku) is not in SQL Server" }

        $cols = "OrderId, ProductId, Quantity, $priceCol"
        $vals = "@o, @p, @q, @u"
        if ($hasLineTotal -and $lineTotalComputed -ne 1) { $cols += ", LineTotal"; $vals += ", @l" }
        $cmd = $conn.CreateCommand(); $cmd.Transaction = $tx
        $cmd.CommandText = "INSERT INTO OrderItems ($cols) VALUES ($vals)"
        [void]$cmd.Parameters.AddWithValue("@o", $orderId)
        [void]$cmd.Parameters.AddWithValue("@p", $prodId)
        [void]$cmd.Parameters.AddWithValue("@q", [int]$i.quantity)
        [void]$cmd.Parameters.AddWithValue("@u", [decimal]$i.unitPriceAtOrder)
        if ($cmd.CommandText -match "@l") { [void]$cmd.Parameters.AddWithValue("@l", [decimal]$i.lineTotal) }
        [void]$cmd.ExecuteNonQuery()
      }
      $counts.ord++
    }
    $tx.Commit()
    $doneOrd += $o.id
  } catch {
    $tx.Rollback()
    Write-Host "Order $($o.orderNumber) failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# ---- Quotations (totals only) ----
foreach ($q in (Rows $data.quotations)) {
  try {
    $exists = Run "SELECT Id FROM Quotations WHERE QuoteNumber=@n" @{ "@n" = $q.quoteNumber }
    if (-not $exists) {
      $custId = Run "SELECT Id FROM Customers WHERE Phone=@p" @{ "@p" = "$($q.customerPhone)" }
      if (-not $custId) { throw "Customer with phone $($q.customerPhone) is not in SQL Server" }
      [void](Run "INSERT INTO Quotations (QuoteNumber, CustomerId, Status, Subtotal, TaxRate, TaxAmount, Total, ValidUntilUtc, CreatedAtUtc) VALUES (@n,@c,@s,@sub,@tr,@ta,@t,@v,@cr)" @{
        "@n" = $q.quoteNumber; "@c" = $custId; "@s" = "$($q.status)"; "@sub" = [decimal]$q.subtotal; "@tr" = [decimal]$q.taxRate; "@ta" = [decimal]$q.taxAmount; "@t" = [decimal]$q.total; "@v" = (Dto $q.validUntilUtc); "@cr" = (Dto $q.createdAtUtc) })
      $counts.quo++
    }
    $doneQuo += $q.id
  } catch { Write-Host "Quotation $($q.quoteNumber) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

# ---- Payments ----
foreach ($p2 in (Rows $data.payments)) {
  try {
    $orderId = Run "SELECT Id FROM Orders WHERE OrderNumber=@n" @{ "@n" = $p2.orderNumber }
    if (-not $orderId) { Write-Host "Payment $($p2.transactionReference) skipped: order $($p2.orderNumber) not in SQL Server yet" -ForegroundColor Yellow; continue }
    $payId = Run "SELECT Id FROM Payments WHERE TransactionReference=@t" @{ "@t" = $p2.transactionReference }
    $paidAt = if ($p2.status -eq "Paid") { (Dto $p2.paidAtUtc) } else { [DBNull]::Value }
    if ($payId) {
      [void](Run "UPDATE Payments SET Status=@s, Amount=@a, PaidAtUtc=@pd WHERE Id=@id" @{ "@s" = "$($p2.status)"; "@a" = [decimal]$p2.amount; "@pd" = $paidAt; "@id" = $payId })
    } else {
      [void](Run "INSERT INTO Payments (OrderId, Amount, Method, Status, TransactionReference, PaidAtUtc, CreatedAtUtc, CustomerName) VALUES (@o,@a,@m,@s,@t,@pd,@cr,@cn)" @{
        "@o" = $orderId; "@a" = [decimal]$p2.amount; "@m" = "$($p2.method)"; "@s" = "$($p2.status)"; "@t" = $p2.transactionReference; "@pd" = $paidAt; "@cr" = (Dto $p2.createdAtUtc); "@cn" = (DbVal $p2.customerName) })
      $counts.pay++
    }
  } catch { Write-Host "Payment $($p2.transactionReference) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

# ---- ProductImages (matched by ImageUrl) ----
foreach ($im in (Rows $data.productImages)) {
  try {
    $id = Run "SELECT Id FROM ProductImages WHERE ImageUrl=@u" @{ "@u" = $im.imageUrl }
    $prm = @{ "@i" = $im.image; "@t" = "$($im.thickness)"; "@sl" = (DbVal $im.sizeLabel); "@u" = $im.imageUrl; "@so" = [int]$im.sortOrder; "@a" = [int]$im.isActive; "@cr" = (Dto $im.createdAtUtc) }
    if ($id) {
      $prm["@id"] = $id
      [void](Run "UPDATE ProductImages SET Image=@i, Thickness=@t, SizeLabel=@sl, SortOrder=@so, IsActive=@a WHERE Id=@id" $prm)
    } else {
      [void](Run "INSERT INTO ProductImages (Image, Thickness, SizeLabel, ImageUrl, SortOrder, IsActive, CreatedAtUtc) VALUES (@i,@t,@sl,@u,@so,@a,@cr)" $prm)
      $counts.img++
    }
  } catch { Write-Host "ProductImage $($im.imageUrl) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

# ---- AdminUsers (matched by UserName) ----
foreach ($ad in (Rows $data.adminUsers)) {
  try {
    $id = Run "SELECT Id FROM AdminUsers WHERE UserName=@n" @{ "@n" = $ad.userName }
    $prm = @{ "@n" = $ad.userName; "@e" = $ad.email; "@ph" = $ad.passwordHash; "@r" = "$($ad.role)"; "@a" = [int]$ad.isActive; "@cr" = (Dto $ad.createdAtUtc) }
    if ($id) {
      $prm["@id"] = $id
      [void](Run "UPDATE AdminUsers SET Email=@e, PasswordHash=@ph, Role=@r, IsActive=@a WHERE Id=@id" $prm)
    } else {
      [void](Run "INSERT INTO AdminUsers (UserName, Email, PasswordHash, Role, IsActive, CreatedAtUtc) VALUES (@n,@e,@ph,@r,@a,@cr)" $prm)
      $counts.adm++
    }
  } catch { Write-Host "AdminUser $($ad.userName) failed: $($_.Exception.Message)" -ForegroundColor Red }
}

$conn.Close()

$body = @{ customerIds = $doneCust; orderIds = $doneOrd; quotationIds = $doneQuo } | ConvertTo-Json
[void](Invoke-RestMethod -Uri "$api/api/sync/done" -Method Post -Headers $headers -ContentType "application/json" -Body $body)

Write-Host ("Done. Copied: {0} categories, {1} products, {2} customers, {3} orders, {4} quotations, {5} payments, {6} product images, {7} admin users" -f `
  $counts.cat, $counts.prod, $counts.cust, $counts.ord, $counts.quo, $counts.pay, $counts.img, $counts.adm) -ForegroundColor Green