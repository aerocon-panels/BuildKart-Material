INSERT INTO Categories (Id, Name, Description, IsActive) VALUES
(1, 'Aerocon Panels', 'Lightweight panels for partitions and exterior walls.', 1),
(2, 'Bison Boards', 'Fibre cement boards for interior and exterior use.', 1),
(3, 'Roofing Sheets', 'Weather-resistant roofing materials.', 1),
(4, 'Elevation Planks', 'Decorative planks for building elevations.', 1);

INSERT INTO Products (Id, Sku, Name, Description, Specification, UnitPrice, UnitOfMeasure, CategoryId, IsActive) VALUES
(1, 'AEROCON-SANDWICH-50', 'Aerocon Sandwich Panel', 'Lightweight 50mm aerated-concrete partition panel with fire resistance and sound insulation. Each 8ft x 2ft panel covers 16 sq. ft.', '50mm - 8ft x 2ft', 1360, 'piece', 1, 1),
(2, 'AEROCON-SANDWICH-75-8FT', 'Aerocon Sandwich Partition Panel – 8ft', 'Strong 75mm lightweight aerated-concrete partition panel with fire resistance and sound insulation. Covers 16 sq. ft.', '75mm - 8ft x 2ft', 1360, 'piece', 1, 1),
(3, 'AEROCON-SANDWICH-75-9FT', 'Aerocon Sandwich Partition Panel – 9ft', 'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.', '75mm - 9ft x 2ft', 1530, 'piece', 1, 1),
(4, 'AEROCON-SANDWICH-75-10FT', 'Aerocon Sandwich Partition Panel – 10ft', 'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.', '75mm - 10ft x 2ft', 1700, 'piece', 1, 1),
(5, 'BISON-CEMENT-12', 'Bison Cement Board', 'Durable fibre cement board for interior and exterior use.', '12mm - 8ft x 4ft', 1856, 'piece', 2, 1),
(6, 'ROOFING-COLOUR-045', 'Colour Coated Roofing Sheet', 'Weather-resistant roofing sheet for a practical roof finish.', '0.45mm - custom length', 72, 'piece', 3, 1),
(7, 'ELEVATION-PLANK-8FT', 'Exterior Elevation Plank', 'Decorative plank for contemporary building elevations.', '8ft - wood finish', 760, 'piece', 4, 1);