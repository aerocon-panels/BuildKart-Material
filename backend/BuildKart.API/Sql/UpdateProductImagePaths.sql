USE [BuildKartDB];
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @UpdatedRows int;

    UPDATE dbo.ProductImages
    SET ImageUrl = CASE Id
        WHEN 1 THEN N'/product-images/75mm/aerocon-75mm.png'
        WHEN 2 THEN N'/product-images/75mm/Aerocon_Panel_8x2ft.png'
        WHEN 3 THEN N'/product-images/75mm/Aerocon_Panel_9x2ft.png'
        WHEN 4 THEN N'/product-images/75mm/Aerocon_Panel_10x2ft.png'
    END
    WHERE Id IN (1, 2, 3, 4);

    SET @UpdatedRows = @@ROWCOUNT;
    IF @UpdatedRows <> 4
    BEGIN
        ;THROW 50001, 'Expected exactly four ProductImages rows with Ids 1 through 4.', 1;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;
    THROW;
END CATCH;

SELECT Id, Image, Thickness, SizeLabel, ImageUrl, SortOrder, IsActive, CreatedAtUtc
FROM dbo.ProductImages
WHERE Id IN (1, 2, 3, 4)
ORDER BY Id;
