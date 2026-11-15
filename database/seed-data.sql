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
     N'Lightweight insulated panel for partitions and exterior walls.',
     N'50mm - 8ft x 2ft', CAST(1360.00 AS decimal(18,2)), N'Aerocon Panels'),
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
