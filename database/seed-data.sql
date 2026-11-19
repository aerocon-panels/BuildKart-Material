-- Sample storefront catalog. Run schema.sql first; no customer or admin credentials are seeded.
INSERT INTO dbo.Categories (Name, Description)
SELECT source.Name, source.Description
FROM (VALUES
    (N'Aerocon Panels', N'Lightweight panels for partitions and exterior walls.'),
    (N'Bison Boards', N'Fibre cement boards for interior and exterior use.'),
    (N'Roofing Sheets', N'Weather-resistant roofing materials.'),
    (N'Elevation Planks', N'Decorative planks for building elevations.')
) AS source(Name, Description)
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.Categories AS existing WHERE existing.Name = source.Name
);

UPDATE product
SET
    product.Sku = source.NewSku,
    product.Name = source.Name,
    product.Description = source.Description,
    product.Specification = source.Specification,
    product.UnitPrice = source.UnitPrice
FROM dbo.Products AS product
INNER JOIN (VALUES
    (N'AEROCON-SANDWICH-175-8FT', N'AEROCON-SANDWICH-75-8FT', N'Aerocon Sandwich Partition Panel – 8ft', N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.', N'75mm - 8ft x 2ft', CAST(1360.00 AS decimal(18,2))),
    (N'AEROCON-SANDWICH-175-9FT', N'AEROCON-SANDWICH-75-9FT', N'Aerocon Sandwich Partition Panel – 9ft', N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.', N'75mm - 9ft x 2ft', CAST(1530.00 AS decimal(18,2))),
    (N'AEROCON-SANDWICH-175-10FT', N'AEROCON-SANDWICH-75-10FT', N'Aerocon Sandwich Partition Panel – 10ft', N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.', N'75mm - 10ft x 2ft', CAST(1700.00 AS decimal(18,2)))
) AS source(OldSku, NewSku, Name, Description, Specification, UnitPrice)
    ON source.OldSku = product.Sku
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.Products AS existing WHERE existing.Sku = source.NewSku
);

UPDATE oldProduct
SET oldProduct.IsActive = 0
FROM dbo.Products AS oldProduct
INNER JOIN (VALUES
    (N'AEROCON-SANDWICH-175-8FT', N'AEROCON-SANDWICH-75-8FT'),
    (N'AEROCON-SANDWICH-175-9FT', N'AEROCON-SANDWICH-75-9FT'),
    (N'AEROCON-SANDWICH-175-10FT', N'AEROCON-SANDWICH-75-10FT')
) AS source(OldSku, NewSku) ON source.OldSku = oldProduct.Sku
WHERE EXISTS
(
    SELECT 1 FROM dbo.Products AS currentProduct WHERE currentProduct.Sku = source.NewSku
);

INSERT INTO dbo.Products
    (Sku, Name, Description, Specification, UnitPrice, UnitOfMeasure, CategoryId)
SELECT
    source.Sku,
    source.Name,
    source.Description,
    source.Specification,
    source.UnitPrice,
    N'piece',
    category.Id
FROM (VALUES
    (N'AEROCON-SANDWICH-50', N'Aerocon Sandwich Panel',
     N'An ideal solution for lightweight and space-efficient interior partitions. The 50mm aerated-concrete panel provides reliable fire resistance and sound insulation while maximizing usable space. Perfect for residential and commercial applications, each 8ft × 2ft panel covers 16 sq. ft., making installation and area planning simple and convenient.',
     N'50mm - 8ft x 2ft', CAST(1360.00 AS decimal(18,2)), N'Aerocon Panels'),
    (N'AEROCON-SANDWICH-75-8FT', N'Aerocon Sandwich Partition Panel – 8ft',
     N'A perfect choice for strong and durable partition walls in residential and commercial spaces. The 75mm lightweight aerated-concrete panel offers excellent fire resistance and sound insulation, making it ideal for creating comfortable and reliable room partitions. Each 8ft × 2ft panel covers 16 sq. ft., ensuring easy installation and efficient space planning.',
     N'75mm - 8ft x 2ft', CAST(1360.00 AS decimal(18,2)), N'Aerocon Panels'),
    (N'AEROCON-SANDWICH-75-9FT', N'Aerocon Sandwich Partition Panel – 9ft',
     N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.',
     N'75mm - 9ft x 2ft', CAST(1530.00 AS decimal(18,2)), N'Aerocon Panels'),
    (N'AEROCON-SANDWICH-75-10FT', N'Aerocon Sandwich Partition Panel – 10ft',
     N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.',
     N'75mm - 10ft x 2ft', CAST(1700.00 AS decimal(18,2)), N'Aerocon Panels'),
    (N'BISON-CEMENT-12', N'Bison Cement Board',
     N'Durable fibre cement board for interior and exterior use.',
     N'12mm - 8ft x 4ft', CAST(1856.00 AS decimal(18,2)), N'Bison Boards'),
    (N'ROOFING-COLOUR-045', N'Colour Coated Roofing Sheet',
     N'Weather-resistant roofing sheet for a practical roof finish.',
     N'0.45mm - custom length', CAST(72.00 AS decimal(18,2)), N'Roofing Sheets'),
    (N'ELEVATION-PLANK-8FT', N'Exterior Elevation Plank',
     N'Decorative plank for contemporary building elevations.',
     N'8ft - wood finish', CAST(760.00 AS decimal(18,2)), N'Elevation Planks')
) AS source(Sku, Name, Description, Specification, UnitPrice, CategoryName)
INNER JOIN dbo.Categories AS category ON category.Name = source.CategoryName
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.Products AS existing WHERE existing.Sku = source.Sku
);

UPDATE product
SET product.Description = source.Description
FROM dbo.Products AS product
INNER JOIN (VALUES
    (N'AEROCON-SANDWICH-50', N'An ideal solution for lightweight and space-efficient interior partitions. The 50mm aerated-concrete panel provides reliable fire resistance and sound insulation while maximizing usable space. Perfect for residential and commercial applications, each 8ft × 2ft panel covers 16 sq. ft., making installation and area planning simple and convenient.'),
    (N'AEROCON-SANDWICH-75-8FT', N'A perfect choice for strong and durable partition walls in residential and commercial spaces. The 75mm lightweight aerated-concrete panel offers excellent fire resistance and sound insulation, making it ideal for creating comfortable and reliable room partitions. Each 8ft × 2ft panel covers 16 sq. ft., ensuring easy installation and efficient space planning.'),
    (N'AEROCON-SANDWICH-75-9FT', N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.'),
    (N'AEROCON-SANDWICH-75-10FT', N'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.')
) AS source(Sku, Description) ON source.Sku = product.Sku;
