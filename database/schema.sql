-- Run against an existing SQL Server database. This script does not create a database.
CREATE TABLE dbo.Categories
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
    Name nvarchar(100) NOT NULL,
    Description nvarchar(500) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT (1),
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Categories_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Categories_Name UNIQUE (Name)
);

CREATE TABLE dbo.Products
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
    Sku nvarchar(50) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Description nvarchar(1000) NULL,
    Specification nvarchar(200) NULL,
    UnitPrice decimal(18,2) NOT NULL,
    UnitOfMeasure nvarchar(30) NOT NULL CONSTRAINT DF_Products_UnitOfMeasure DEFAULT (N'piece'),
    CategoryId int NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Products_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku),
    CONSTRAINT CK_Products_UnitPrice_Range CHECK (UnitPrice > 0 AND UnitPrice <= 999999999),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories (Id)
);
CREATE INDEX IX_Products_CategoryId ON dbo.Products (CategoryId);

CREATE TABLE dbo.Customers
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Customers PRIMARY KEY,
    Name nvarchar(150) NOT NULL,
    Email nvarchar(254) NULL,
    Phone nvarchar(20) NOT NULL,
    Address nvarchar(300) NULL,
    PostalCode nvarchar(20) NULL,
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Customers_CreatedAtUtc DEFAULT (SYSUTCDATETIME())
);
CREATE UNIQUE INDEX UX_Customers_Email ON dbo.Customers (Email) WHERE Email IS NOT NULL;

CREATE TABLE dbo.Orders
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    OrderNumber nvarchar(20) NOT NULL,
    CustomerId int NOT NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT (N'Pending'),
    Subtotal decimal(18,2) NOT NULL,
    TaxRate decimal(5,4) NOT NULL,
    TaxAmount decimal(18,2) NOT NULL,
    Total decimal(18,2) NOT NULL,
    Notes nvarchar(1000) NULL,
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Orders_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Orders_OrderNumber UNIQUE (OrderNumber),
    CONSTRAINT CK_Orders_TaxRate_Range CHECK (TaxRate >= 0 AND TaxRate <= 1),
    CONSTRAINT CK_Orders_Amounts_Nonnegative CHECK (Subtotal >= 0 AND TaxAmount >= 0 AND Total >= 0),
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (Id)
);
CREATE INDEX IX_Orders_CustomerId ON dbo.Orders (CustomerId);
CREATE INDEX IX_Orders_CreatedAtUtc ON dbo.Orders (CreatedAtUtc);

CREATE TABLE dbo.OrderItems
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
    OrderId int NOT NULL,
    ProductId int NOT NULL,
    Quantity decimal(18,3) NOT NULL,
    UnitPriceAtOrder decimal(18,2) NOT NULL,
    LineTotal AS CAST(Quantity * UnitPriceAtOrder AS decimal(18,2)) PERSISTED,
    CONSTRAINT CK_OrderItems_Quantity_Range CHECK (Quantity > 0 AND Quantity <= 100000),
    CONSTRAINT CK_OrderItems_UnitPrice_Range CHECK (UnitPriceAtOrder > 0 AND UnitPriceAtOrder <= 999999999),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders (Id),
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products (Id)
);
CREATE INDEX IX_OrderItems_OrderId ON dbo.OrderItems (OrderId);
CREATE INDEX IX_OrderItems_ProductId ON dbo.OrderItems (ProductId);

CREATE TABLE dbo.Quotations
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Quotations PRIMARY KEY,
    QuoteNumber nvarchar(20) NOT NULL,
    CustomerId int NOT NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Quotations_Status DEFAULT (N'Draft'),
    Subtotal decimal(18,2) NOT NULL,
    TaxRate decimal(5,4) NOT NULL,
    TaxAmount decimal(18,2) NOT NULL,
    Total decimal(18,2) NOT NULL,
    ValidUntilUtc datetimeoffset(0) NULL,
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Quotations_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Quotations_QuoteNumber UNIQUE (QuoteNumber),
    CONSTRAINT CK_Quotations_TaxRate_Range CHECK (TaxRate >= 0 AND TaxRate <= 1),
    CONSTRAINT FK_Quotations_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (Id)
);
CREATE INDEX IX_Quotations_CustomerId ON dbo.Quotations (CustomerId);

CREATE TABLE dbo.Payments
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
    OrderId int NOT NULL,
    Amount decimal(18,2) NOT NULL,
    Method nvarchar(30) NOT NULL,
    PaymentType nvarchar(30) NOT NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT (N'Pending'),
    TransactionReference nvarchar(100) NULL,
    GatewayTransactionId nvarchar(100) NULL,
    PaidAtUtc datetimeoffset(0) NULL,
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Payments_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_Payments_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Payments_Amount_Positive CHECK (Amount > 0),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders (Id)
);
CREATE UNIQUE INDEX UX_Payments_TransactionReference
    ON dbo.Payments (TransactionReference) WHERE TransactionReference IS NOT NULL;
CREATE UNIQUE INDEX UX_Payments_GatewayTransactionId
    ON dbo.Payments (GatewayTransactionId) WHERE GatewayTransactionId IS NOT NULL;
CREATE INDEX IX_Payments_OrderId ON dbo.Payments (OrderId);

CREATE TABLE dbo.AdminUsers
(
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdminUsers PRIMARY KEY,
    UserName nvarchar(100) NOT NULL,
    Email nvarchar(254) NOT NULL,
    PasswordHash nvarchar(500) NOT NULL,
    Role nvarchar(30) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_AdminUsers_IsActive DEFAULT (1),
    CreatedAtUtc datetimeoffset(0) NOT NULL CONSTRAINT DF_AdminUsers_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_AdminUsers_UserName UNIQUE (UserName),
    CONSTRAINT UQ_AdminUsers_Email UNIQUE (Email)
);
