IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

CREATE TABLE [Branches] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [Address] nvarchar(max) NOT NULL,
    [City] nvarchar(max) NOT NULL,
    [Region] nvarchar(max) NOT NULL,
    [PostalCode] int NOT NULL,
    [Country] nvarchar(max) NOT NULL,
    [Phone] int NOT NULL,
    [HomePage] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_Branches] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [Users] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [LastName] nvarchar(max) NOT NULL,
    [Password] nvarchar(max) NOT NULL,
    [Phone] int NOT NULL,
    [BarberShopId] bigint NOT NULL,
    [Picture] nvarchar(max) NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Users_Branches_BarberShopId] FOREIGN KEY ([BarberShopId]) REFERENCES [Branches] ([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_Users_BarberShopId] ON [Users] ([BarberShopId]);
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251104034038_test', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251104034236_test_2', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

ALTER TABLE [Users] ADD [Role] int NOT NULL DEFAULT 0;
GO

CREATE TABLE [Clients] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [LastName] nvarchar(max) NOT NULL,
    [Phone] int NOT NULL,
    CONSTRAINT [PK_Clients] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [Items] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NOT NULL,
    [Price] decimal(18,2) NOT NULL,
    [IsAvailable] bit NOT NULL,
    [BranchId] bigint NOT NULL,
    CONSTRAINT [PK_Items] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Items_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [ClientAddresses] (
    [Id] bigint NOT NULL IDENTITY,
    [Street] nvarchar(max) NOT NULL,
    [City] nvarchar(max) NOT NULL,
    [Region] nvarchar(max) NOT NULL,
    [PostalCode] int NOT NULL,
    [Country] nvarchar(max) NOT NULL,
    [Label] nvarchar(max) NOT NULL,
    [ClientId] bigint NOT NULL,
    CONSTRAINT [PK_ClientAddresses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ClientAddresses_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [Orders] (
    [Id] bigint NOT NULL IDENTITY,
    [OrderDate] datetime2 NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [ClientId] bigint NOT NULL,
    [ClientAddressId] bigint NOT NULL,
    CONSTRAINT [PK_Orders] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Orders_ClientAddresses_ClientAddressId] FOREIGN KEY ([ClientAddressId]) REFERENCES [ClientAddresses] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Orders_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [OrderItems] (
    [Id] bigint NOT NULL IDENTITY,
    [OrderId] bigint NOT NULL,
    [ItemId] bigint NOT NULL,
    [Quantity] int NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL,
    [Note] nvarchar(max) NULL,
    CONSTRAINT [PK_OrderItems] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_OrderItems_Items_ItemId] FOREIGN KEY ([ItemId]) REFERENCES [Items] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_OrderItems_Orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [Orders] ([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_ClientAddresses_ClientId] ON [ClientAddresses] ([ClientId]);
GO

CREATE INDEX [IX_Items_BranchId] ON [Items] ([BranchId]);
GO

CREATE INDEX [IX_OrderItems_ItemId] ON [OrderItems] ([ItemId]);
GO

CREATE INDEX [IX_OrderItems_OrderId] ON [OrderItems] ([OrderId]);
GO

CREATE INDEX [IX_Orders_ClientAddressId] ON [Orders] ([ClientAddressId]);
GO

CREATE INDEX [IX_Orders_ClientId] ON [Orders] ([ClientId]);
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251105232404_Inicial', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

ALTER TABLE [OrderItems] DROP CONSTRAINT [FK_OrderItems_Items_ItemId];
GO

ALTER TABLE [Orders] DROP CONSTRAINT [FK_Orders_Clients_ClientId];
GO

ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Branches_BarberShopId];
GO

DROP TABLE [Items];
GO

DECLARE @var0 sysname;
SELECT @var0 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[OrderItems]') AND [c].[name] = N'Note');
IF @var0 IS NOT NULL EXEC(N'ALTER TABLE [OrderItems] DROP CONSTRAINT [' + @var0 + '];');
ALTER TABLE [OrderItems] DROP COLUMN [Note];
GO

EXEC sp_rename N'[Users].[BarberShopId]', N'BranchId', N'COLUMN';
GO

EXEC sp_rename N'[Users].[IX_Users_BarberShopId]', N'IX_Users_BranchId', N'INDEX';
GO

EXEC sp_rename N'[Orders].[Status]', N'CurrentStatus', N'COLUMN';
GO

EXEC sp_rename N'[OrderItems].[ItemId]', N'ProductId', N'COLUMN';
GO

EXEC sp_rename N'[OrderItems].[IX_OrderItems_ItemId]', N'IX_OrderItems_ProductId', N'INDEX';
GO

ALTER TABLE [Users] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [Users] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [Users] ADD [UpdatedAt] datetime2 NULL;
GO

DECLARE @var1 sysname;
SELECT @var1 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Orders]') AND [c].[name] = N'ClientId');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Orders] DROP CONSTRAINT [' + @var1 + '];');
ALTER TABLE [Orders] ALTER COLUMN [ClientId] bigint NULL;
GO

ALTER TABLE [Orders] ADD [BranchId] bigint NOT NULL DEFAULT CAST(0 AS bigint);
GO

ALTER TABLE [Orders] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [Orders] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [Orders] ADD [Note] nvarchar(max) NULL;
GO

ALTER TABLE [Orders] ADD [TrackingNumber] uniqueidentifier NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
GO

ALTER TABLE [Orders] ADD [UpdatedAt] datetime2 NULL;
GO

ALTER TABLE [OrderItems] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [OrderItems] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [OrderItems] ADD [UpdatedAt] datetime2 NULL;
GO

ALTER TABLE [Clients] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [Branches] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [Branches] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [Branches] ADD [UpdatedAt] datetime2 NULL;
GO

CREATE TABLE [Categories] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [Description] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_Categories] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [Ingredients] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [UnitOfMeasure] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_Ingredients] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [OrderStatusHistories] (
    [Id] bigint NOT NULL IDENTITY,
    [OrderId] bigint NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [ChangeDate] datetime2 NOT NULL,
    [ChangedByUserId] bigint NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_OrderStatusHistories] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_OrderStatusHistories_Orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [Orders] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [Products] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(150) NOT NULL,
    [Description] nvarchar(max) NULL,
    [Price] decimal(18,2) NOT NULL,
    [ImageUrl] nvarchar(max) NULL,
    [IsActive] bit NOT NULL,
    [CategoryId] bigint NOT NULL,
    [BranchId] bigint NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_Products] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Products_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([Id]),
    CONSTRAINT [FK_Products_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [BranchStocks] (
    [Id] bigint NOT NULL IDENTITY,
    [BranchId] bigint NOT NULL,
    [IngredientId] bigint NOT NULL,
    [CurrentStock] decimal(18,2) NOT NULL,
    [MinimumStockAlert] decimal(18,2) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_BranchStocks] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_BranchStocks_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_BranchStocks_Ingredients_IngredientId] FOREIGN KEY ([IngredientId]) REFERENCES [Ingredients] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [ProductIngredients] (
    [ProductId] bigint NOT NULL,
    [IngredientId] bigint NOT NULL,
    [QuantityRequired] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_ProductIngredients] PRIMARY KEY ([ProductId], [IngredientId]),
    CONSTRAINT [FK_ProductIngredients_Ingredients_IngredientId] FOREIGN KEY ([IngredientId]) REFERENCES [Ingredients] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ProductIngredients_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products] ([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_Orders_BranchId] ON [Orders] ([BranchId]);
GO

CREATE UNIQUE INDEX [IX_BranchStocks_BranchId_IngredientId] ON [BranchStocks] ([BranchId], [IngredientId]);
GO

CREATE INDEX [IX_BranchStocks_IngredientId] ON [BranchStocks] ([IngredientId]);
GO

CREATE INDEX [IX_OrderStatusHistories_OrderId] ON [OrderStatusHistories] ([OrderId]);
GO

CREATE INDEX [IX_ProductIngredients_IngredientId] ON [ProductIngredients] ([IngredientId]);
GO

CREATE INDEX [IX_Products_BranchId] ON [Products] ([BranchId]);
GO

CREATE INDEX [IX_Products_CategoryId] ON [Products] ([CategoryId]);
GO

ALTER TABLE [OrderItems] ADD CONSTRAINT [FK_OrderItems_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products] ([Id]) ON DELETE CASCADE;
GO

ALTER TABLE [Orders] ADD CONSTRAINT [FK_Orders_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([Id]) ON DELETE CASCADE;
GO

ALTER TABLE [Orders] ADD CONSTRAINT [FK_Orders_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]);
GO

ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([Id]) ON DELETE CASCADE;
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251212192200_ModelosFinales', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

ALTER TABLE [ProductIngredients] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [ProductIngredients] ADD [Id] bigint NOT NULL DEFAULT CAST(0 AS bigint);
GO

ALTER TABLE [ProductIngredients] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [ProductIngredients] ADD [UpdatedAt] datetime2 NULL;
GO

ALTER TABLE [Clients] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [Clients] ADD [UpdatedAt] datetime2 NULL;
GO

ALTER TABLE [ClientAddresses] ADD [CreatedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
GO

ALTER TABLE [ClientAddresses] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);
GO

ALTER TABLE [ClientAddresses] ADD [UpdatedAt] datetime2 NULL;
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251213080858_refactor', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

DECLARE @var2 sysname;
SELECT @var2 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Ingredients]') AND [c].[name] = N'UnitOfMeasure');
IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Ingredients] DROP CONSTRAINT [' + @var2 + '];');
ALTER TABLE [Ingredients] ALTER COLUMN [UnitOfMeasure] nvarchar(10) NOT NULL;
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251213094553_ingredient', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

EXEC sp_rename N'[ProductIngredients].[QuantityRequired]', N'Quantity', N'COLUMN';
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251213104348_ingredient_2', N'8.0.0');
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

ALTER TABLE [Orders] ADD [Discount] decimal(18,2) NOT NULL DEFAULT 0.0;
GO

ALTER TABLE [OrderItems] ADD [Discount] decimal(18,2) NOT NULL DEFAULT 0.0;
GO

ALTER TABLE [OrderItems] ADD [Observation] nvarchar(max) NOT NULL DEFAULT N'';
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251214053814_update_order_item', N'8.0.0');
GO

COMMIT;
GO

