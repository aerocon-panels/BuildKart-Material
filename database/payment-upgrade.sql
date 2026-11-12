-- Apply once to an existing BuildKart database before enabling the payment API.
ALTER TABLE dbo.Payments
    ADD PaymentType nvarchar(30) NOT NULL
        CONSTRAINT DF_Payments_PaymentType DEFAULT (N'FullPayment');

ALTER TABLE dbo.Payments
    ADD GatewayTransactionId nvarchar(100) NULL;

ALTER TABLE dbo.Payments
    ADD UpdatedAtUtc datetimeoffset(0) NOT NULL
        CONSTRAINT DF_Payments_UpdatedAtUtc DEFAULT (SYSUTCDATETIME());

CREATE UNIQUE INDEX UX_Payments_GatewayTransactionId
    ON dbo.Payments (GatewayTransactionId) WHERE GatewayTransactionId IS NOT NULL;
