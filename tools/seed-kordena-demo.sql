SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    DECLARE @BranchId bigint = (
        SELECT TOP 1 BranchId
        FROM dbo.Users
        WHERE LTRIM(RTRIM(Username)) = N'maurobense' AND IsDeleted = 0
    );

    DECLARE @MauroUserId bigint = (
        SELECT TOP 1 Id
        FROM dbo.Users
        WHERE LTRIM(RTRIM(Username)) = N'maurobense' AND IsDeleted = 0
    );

    DECLARE @KitchenUserId bigint = COALESCE((
        SELECT TOP 1 Id
        FROM dbo.Users
        WHERE BranchId = @BranchId AND IsDeleted = 0 AND Role IN (N'Kitchen', N'2')
        ORDER BY Id
    ), @MauroUserId);

    DECLARE @DeliveryUserId bigint = COALESCE((
        SELECT TOP 1 Id
        FROM dbo.Users
        WHERE BranchId = @BranchId AND IsDeleted = 0 AND Role IN (N'Delivery', N'3', N'Waiter')
        ORDER BY Id
    ), @MauroUserId);

    IF @BranchId IS NULL
        THROW 51000, 'No se encontro el usuario maurobense o no tiene sucursal asignada.', 1;

    DECLARE @SeedTag nvarchar(60) = N'KORDENA_DEMO_202605';

    DECLARE @SeedOrders table (Id bigint PRIMARY KEY);
    INSERT INTO @SeedOrders (Id)
    SELECT Id
    FROM dbo.Orders
    WHERE BranchId = @BranchId AND Note LIKE N'%' + @SeedTag + N'%';

    DELETE FROM dbo.OrderStatusHistories WHERE OrderId IN (SELECT Id FROM @SeedOrders);
    DELETE FROM dbo.OrderItems WHERE OrderId IN (SELECT Id FROM @SeedOrders);
    DELETE FROM dbo.Orders WHERE Id IN (SELECT Id FROM @SeedOrders);

    DELETE FROM dbo.CashMovements
    WHERE CashSessionId IN (SELECT Id FROM dbo.CashSessions WHERE Notes LIKE N'%' + @SeedTag + N'%');
    DELETE FROM dbo.CashSessions WHERE Notes LIKE N'%' + @SeedTag + N'%';

    UPDATE dbo.BranchStocks
    SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
    WHERE BranchId = @BranchId
      AND IngredientId IN (SELECT Id FROM dbo.Ingredients WHERE BranchId = @BranchId AND LOWER(Name) = N'test');

    UPDATE dbo.Ingredients
    SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
    WHERE BranchId = @BranchId AND LOWER(Name) = N'test';

    UPDATE dbo.Categories
    SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
    WHERE BranchId = @BranchId AND LOWER(Name) = N'test';

    DECLARE @Categories table (Name nvarchar(100), Description nvarchar(max));
    INSERT INTO @Categories (Name, Description) VALUES
        (N'Hamburguesas', N'Medallones smash, pan artesanal y toppings premium.'),
        (N'Milanesas', N'Clasicos de rotiseria con guarniciones abundantes.'),
        (N'Pizzas', N'Pizzas y pizzetas de alta rotacion.'),
        (N'Papas y sides', N'Acompanamientos para combos y venta incremental.'),
        (N'Bebidas', N'Bebidas frias, aguas y cervezas.'),
        (N'Postres', N'Dulces y cierres de ticket.');

    MERGE dbo.Categories AS target
    USING @Categories AS source
        ON target.BranchId = @BranchId AND target.Name = source.Name
    WHEN MATCHED THEN
        UPDATE SET Description = source.Description, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Name, Description, BranchId, CreatedAt, IsDeleted)
        VALUES (source.Name, source.Description, @BranchId, SYSUTCDATETIME(), 0);

    DECLARE @Products table (
        Name nvarchar(150),
        Description nvarchar(max),
        Price decimal(18,2),
        CategoryName nvarchar(100),
        ImageUrl nvarchar(max)
    );

    INSERT INTO @Products (Name, Description, Price, CategoryName, ImageUrl) VALUES
        (N'Kordena Smash Simple', N'Carne smash, cheddar, pickles y salsa de la casa.', 330, N'Hamburguesas', N'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80'),
        (N'Kordena Smash Doble', N'Doble carne, doble cheddar, cebolla crispy y salsa especial.', 470, N'Hamburguesas', N'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80'),
        (N'Bacon Blue', N'Doble carne, bacon, queso azul suave y cebolla caramelizada.', 540, N'Hamburguesas', N'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=900&q=80'),
        (N'Criolla Burger', N'Carne, provolone, morron asado, chimichurri y mayo de ajo.', 510, N'Hamburguesas', N'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80'),
        (N'Veggie Crunch', N'Medallon veggie, cheddar, palta, tomate y alioli.', 430, N'Hamburguesas', N'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=80'),
        (N'Milanesa Clasica', N'Milanesa al pan con lechuga, tomate y mayonesa.', 360, N'Milanesas', N'https://images.unsplash.com/photo-1625938145744-e38051539961?auto=format&fit=crop&w=900&q=80'),
        (N'Milanesa Napolitana', N'Milanesa con salsa, muzzarella, jamon y papas.', 620, N'Milanesas', N'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80'),
        (N'Milanesa Cheddar Bacon', N'Milanesa con cheddar fundido, bacon y papas rusticas.', 690, N'Milanesas', N'https://images.unsplash.com/photo-1562967916-eb82221dfb36?auto=format&fit=crop&w=900&q=80'),
        (N'Pizza Muzzarella', N'Masa media, salsa de tomate y muzzarella.', 410, N'Pizzas', N'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80'),
        (N'Pizza Pepperoni', N'Muzzarella, pepperoni y oregano.', 540, N'Pizzas', N'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=80'),
        (N'Pizza Fugazzeta', N'Muzzarella, cebolla, oregano y aceite de oliva.', 500, N'Pizzas', N'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80'),
        (N'Papas Clasicas', N'Papas baston doradas.', 190, N'Papas y sides', N'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80'),
        (N'Papas Cheddar Bacon', N'Papas con cheddar, bacon y verdeo.', 340, N'Papas y sides', N'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=80'),
        (N'Aros de Cebolla', N'Aros crocantes con salsa ranch.', 260, N'Papas y sides', N'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=80'),
        (N'Nuggets x8', N'Nuggets de pollo con salsa a eleccion.', 290, N'Papas y sides', N'https://images.unsplash.com/photo-1562967916-eb82221dfb36?auto=format&fit=crop&w=900&q=80'),
        (N'Coca-Cola 600ml', N'Botella fria 600ml.', 120, N'Bebidas', N'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
        (N'Coca-Cola Zero 600ml', N'Botella fria 600ml sin azucar.', 120, N'Bebidas', N'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
        (N'Agua Mineral', N'Agua sin gas 600ml.', 90, N'Bebidas', N'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80'),
        (N'Cerveza Artesanal', N'Lata 473ml estilo golden.', 220, N'Bebidas', N'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80'),
        (N'Brownie', N'Brownie humedo con nuez.', 210, N'Postres', N'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80'),
        (N'Cheesecake Frutos Rojos', N'Porcion individual con coulis.', 260, N'Postres', N'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80'),
        (N'Flan Casero', N'Flan con dulce de leche.', 190, N'Postres', N'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80');

    MERGE dbo.Products AS target
    USING (
        SELECT p.Name, p.Description, p.Price, p.ImageUrl, c.Id AS CategoryId
        FROM @Products p
        JOIN dbo.Categories c ON c.Name = p.CategoryName AND c.BranchId = @BranchId AND c.IsDeleted = 0
    ) AS source
        ON target.BranchId = @BranchId AND target.Name = source.Name
    WHEN MATCHED THEN
        UPDATE SET Description = source.Description, Price = source.Price, ImageUrl = source.ImageUrl,
                   CategoryId = source.CategoryId, IsActive = 1, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Name, Description, Price, ImageUrl, IsActive, BranchId, CategoryId, CreatedAt, IsDeleted)
        VALUES (source.Name, source.Description, source.Price, source.ImageUrl, 1, @BranchId, source.CategoryId, SYSUTCDATETIME(), 0);

    DECLARE @Ingredients table (Name nvarchar(100), UnitOfMeasure nvarchar(10), CurrentStock decimal(18,2), MinStock decimal(18,2), ImageUrl nvarchar(max));
    INSERT INTO @Ingredients (Name, UnitOfMeasure, CurrentStock, MinStock, ImageUrl) VALUES
        (N'Carne vacuna smash', N'kg', 38, 12, N'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=80'),
        (N'Pan brioche', N'unidad', 175, 50, N'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80'),
        (N'Queso cheddar', N'kg', 11, 4, N'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=80'),
        (N'Bacon', N'kg', 6, 3, N'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80'),
        (N'Pickles', N'kg', 4, 2, N'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&w=900&q=80'),
        (N'Cebolla', N'kg', 14, 5, N'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=900&q=80'),
        (N'Tomate', N'kg', 9, 4, N'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=900&q=80'),
        (N'Lechuga', N'unidad', 42, 15, N'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=900&q=80'),
        (N'Papas baston', N'kg', 65, 20, N'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80'),
        (N'Papas rusticas', N'kg', 18, 12, N'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80'),
        (N'Pollo milanesa', N'kg', 21, 8, N'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=900&q=80'),
        (N'Pan rallado', N'kg', 7, 3, N'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80'),
        (N'Muzzarella', N'kg', 17, 7, N'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=80'),
        (N'Salsa tomate', N'l', 13, 5, N'https://images.unsplash.com/photo-1607305387299-a3d9611cd469?auto=format&fit=crop&w=900&q=80'),
        (N'Masa pizza', N'unidad', 82, 25, N'https://images.unsplash.com/photo-1600628422019-5dfb9449c645?auto=format&fit=crop&w=900&q=80'),
        (N'Pepperoni', N'kg', 5, 2, N'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=80'),
        (N'Jamon', N'kg', 8, 3, N'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80'),
        (N'Queso azul', N'kg', 2, 2, N'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=80'),
        (N'Bebida cola', N'unidad', 96, 30, N'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
        (N'Agua mineral', N'unidad', 72, 24, N'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80'),
        (N'Cerveza lata', N'unidad', 36, 18, N'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80'),
        (N'Brownie porcion', N'unidad', 22, 10, N'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80'),
        (N'Cheesecake porcion', N'unidad', 14, 8, N'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80'),
        (N'Flan porcion', N'unidad', 18, 8, N'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80');

    MERGE dbo.Ingredients AS target
    USING @Ingredients AS source
        ON target.BranchId = @BranchId AND target.Name = source.Name
    WHEN MATCHED THEN
        UPDATE SET UnitOfMeasure = source.UnitOfMeasure, ImageUrl = source.ImageUrl, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Name, UnitOfMeasure, ImageUrl, BranchId, CreatedAt, IsDeleted)
        VALUES (source.Name, source.UnitOfMeasure, source.ImageUrl, @BranchId, SYSUTCDATETIME(), 0);

    MERGE dbo.BranchStocks AS target
    USING (
        SELECT @BranchId AS BranchId, i.Id AS IngredientId, s.CurrentStock, s.MinStock
        FROM @Ingredients s
        JOIN dbo.Ingredients i ON i.Name = s.Name AND i.BranchId = @BranchId AND i.IsDeleted = 0
    ) AS source
        ON target.BranchId = source.BranchId AND target.IngredientId = source.IngredientId
    WHEN MATCHED THEN
        UPDATE SET CurrentStock = source.CurrentStock, MinimumStockAlert = source.MinStock, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (BranchId, IngredientId, CurrentStock, MinimumStockAlert, CreatedAt, IsDeleted)
        VALUES (source.BranchId, source.IngredientId, source.CurrentStock, source.MinStock, SYSUTCDATETIME(), 0);

    DECLARE @Recipes table (ProductName nvarchar(150), IngredientName nvarchar(100), Quantity decimal(18,2));
    INSERT INTO @Recipes (ProductName, IngredientName, Quantity) VALUES
        (N'Kordena Smash Simple', N'Carne vacuna smash', 0.16), (N'Kordena Smash Simple', N'Pan brioche', 1), (N'Kordena Smash Simple', N'Queso cheddar', 0.04), (N'Kordena Smash Simple', N'Pickles', 0.03),
        (N'Kordena Smash Doble', N'Carne vacuna smash', 0.32), (N'Kordena Smash Doble', N'Pan brioche', 1), (N'Kordena Smash Doble', N'Queso cheddar', 0.08), (N'Kordena Smash Doble', N'Cebolla', 0.04),
        (N'Bacon Blue', N'Carne vacuna smash', 0.32), (N'Bacon Blue', N'Pan brioche', 1), (N'Bacon Blue', N'Bacon', 0.06), (N'Bacon Blue', N'Queso azul', 0.05),
        (N'Criolla Burger', N'Carne vacuna smash', 0.24), (N'Criolla Burger', N'Pan brioche', 1), (N'Criolla Burger', N'Cebolla', 0.04), (N'Criolla Burger', N'Tomate', 0.05),
        (N'Veggie Crunch', N'Pan brioche', 1), (N'Veggie Crunch', N'Queso cheddar', 0.04), (N'Veggie Crunch', N'Tomate', 0.05), (N'Veggie Crunch', N'Lechuga', 0.25),
        (N'Milanesa Clasica', N'Pollo milanesa', 0.22), (N'Milanesa Clasica', N'Pan rallado', 0.06), (N'Milanesa Clasica', N'Lechuga', 0.20), (N'Milanesa Clasica', N'Tomate', 0.05),
        (N'Milanesa Napolitana', N'Pollo milanesa', 0.28), (N'Milanesa Napolitana', N'Pan rallado', 0.08), (N'Milanesa Napolitana', N'Muzzarella', 0.12), (N'Milanesa Napolitana', N'Salsa tomate', 0.08), (N'Milanesa Napolitana', N'Jamon', 0.06), (N'Milanesa Napolitana', N'Papas baston', 0.30),
        (N'Milanesa Cheddar Bacon', N'Pollo milanesa', 0.28), (N'Milanesa Cheddar Bacon', N'Queso cheddar', 0.08), (N'Milanesa Cheddar Bacon', N'Bacon', 0.06), (N'Milanesa Cheddar Bacon', N'Papas rusticas', 0.35),
        (N'Pizza Muzzarella', N'Masa pizza', 1), (N'Pizza Muzzarella', N'Salsa tomate', 0.12), (N'Pizza Muzzarella', N'Muzzarella', 0.20),
        (N'Pizza Pepperoni', N'Masa pizza', 1), (N'Pizza Pepperoni', N'Salsa tomate', 0.12), (N'Pizza Pepperoni', N'Muzzarella', 0.18), (N'Pizza Pepperoni', N'Pepperoni', 0.08),
        (N'Pizza Fugazzeta', N'Masa pizza', 1), (N'Pizza Fugazzeta', N'Muzzarella', 0.18), (N'Pizza Fugazzeta', N'Cebolla', 0.18),
        (N'Papas Clasicas', N'Papas baston', 0.32), (N'Papas Cheddar Bacon', N'Papas baston', 0.35), (N'Papas Cheddar Bacon', N'Queso cheddar', 0.06), (N'Papas Cheddar Bacon', N'Bacon', 0.04),
        (N'Aros de Cebolla', N'Cebolla', 0.18), (N'Nuggets x8', N'Pollo milanesa', 0.18),
        (N'Coca-Cola 600ml', N'Bebida cola', 1), (N'Coca-Cola Zero 600ml', N'Bebida cola', 1), (N'Agua Mineral', N'Agua mineral', 1), (N'Cerveza Artesanal', N'Cerveza lata', 1),
        (N'Brownie', N'Brownie porcion', 1), (N'Cheesecake Frutos Rojos', N'Cheesecake porcion', 1), (N'Flan Casero', N'Flan porcion', 1);

    MERGE dbo.ProductIngredients AS target
    USING (
        SELECT
            ISNULL((SELECT MAX(Id) FROM dbo.ProductIngredients), 0)
                + ROW_NUMBER() OVER (ORDER BY p.Id, i.Id) AS NewId,
            p.Id AS ProductId,
            i.Id AS IngredientId,
            r.Quantity
        FROM @Recipes r
        JOIN dbo.Products p ON p.Name = r.ProductName AND p.BranchId = @BranchId AND p.IsDeleted = 0
        JOIN dbo.Ingredients i ON i.Name = r.IngredientName AND i.BranchId = @BranchId AND i.IsDeleted = 0
    ) AS source
        ON target.ProductId = source.ProductId AND target.IngredientId = source.IngredientId
    WHEN MATCHED THEN
        UPDATE SET Quantity = source.Quantity, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Id, ProductId, IngredientId, Quantity, CreatedAt, IsDeleted)
        VALUES (source.NewId, source.ProductId, source.IngredientId, source.Quantity, SYSUTCDATETIME(), 0);

    DECLARE @Clients table (Name nvarchar(max), LastName nvarchar(max), Phone int, Street nvarchar(max), City nvarchar(max), Label nvarchar(max));
    INSERT INTO @Clients (Name, LastName, Phone, Street, City, Label) VALUES
        (N'Lucia', N'Pereira', 91234001, N'Av. Giannattasio 21400', N'Ciudad de la Costa', N'Casa'),
        (N'Martin', N'Rodriguez', 91234002, N'Calle 17 Solar 8', N'Solymar', N'Casa'),
        (N'Valentina', N'Fernandez', 91234003, N'Av. Calcagno 1245', N'Lagomar', N'Apto'),
        (N'Santiago', N'Gonzalez', 91234004, N'Rambla Costanera 502', N'El Pinar', N'Casa'),
        (N'Camila', N'Martinez', 91234005, N'Rio Negro 1820', N'Ciudad de la Costa', N'Trabajo'),
        (N'Federico', N'Silva', 91234006, N'Av. Alvear 221', N'Shangrila', N'Casa'),
        (N'Micaela', N'Lopez', 91234007, N'Biarritz 712', N'Lagomar', N'Casa'),
        (N'Ignacio', N'Castro', 91234008, N'Buenos Aires 445', N'Solymar', N'Apto'),
        (N'Sofia', N'Ruiz', 91234009, N'Av. Perez Butler 1902', N'El Pinar', N'Casa'),
        (N'Bruno', N'Acosta', 91234010, N'Uruguay 840', N'Ciudad de la Costa', N'Casa'),
        (N'Florencia', N'Alvarez', 91234011, N'Misiones 1290', N'Solymar', N'Trabajo'),
        (N'Mateo', N'Diaz', 91234012, N'Canelones 111', N'Lagomar', N'Casa'),
        (N'Paula', N'Sosa', 91234013, N'Lavalleja 1755', N'Shangrila', N'Casa'),
        (N'Joaquin', N'Torres', 91234014, N'Av. Brasil 288', N'Ciudad de la Costa', N'Apto'),
        (N'Agustina', N'Ramos', 91234015, N'Bolivia 951', N'El Pinar', N'Casa'),
        (N'Matias', N'Vega', 91234016, N'Av. del Parque 64', N'Lagomar', N'Casa'),
        (N'Carolina', N'Navarro', 91234017, N'Buenos Aires 182', N'Solymar', N'Trabajo'),
        (N'Gaston', N'Medina', 91234018, N'Calle 8 y Rambla', N'Ciudad de la Costa', N'Casa'),
        (N'Emilia', N'Carrasco', 91234019, N'Avenida Italia 302', N'Shangrila', N'Apto'),
        (N'Nicolas', N'Ferreira', 91234020, N'Av. Costanera 955', N'El Pinar', N'Casa'),
        (N'Rocio', N'Mendez', 91234021, N'Calle 24 Manzana 12', N'Lagomar', N'Casa'),
        (N'Diego', N'Paz', 91234022, N'Av. Central 210', N'Solymar', N'Casa'),
        (N'Julieta', N'Morales', 91234023, N'Rincon 588', N'Ciudad de la Costa', N'Trabajo'),
        (N'Tomas', N'Olivera', 91234024, N'Yamandu 315', N'El Pinar', N'Casa'),
        (N'Antonella', N'Suarez', 91234025, N'Acuarela 1428', N'Shangrila', N'Casa'),
        (N'Mauricio', N'Cabrera', 91234026, N'Av. Argentina 610', N'Lagomar', N'Apto'),
        (N'Pilar', N'Ibarra', 91234027, N'Los Ceibos 231', N'Solymar', N'Casa'),
        (N'Rafael', N'Benitez', 91234028, N'Los Aromos 788', N'Ciudad de la Costa', N'Casa'),
        (N'Bianca', N'Costa', 91234029, N'Av. Uruguay 450', N'El Pinar', N'Trabajo'),
        (N'Leonardo', N'Machado', 91234030, N'Calle 5 Solar 12', N'Shangrila', N'Casa'),
        (N'Natalia', N'Borges', 91234031, N'Av. Rivera 1040', N'Lagomar', N'Casa'),
        (N'Rodrigo', N'Arias', 91234032, N'Garibaldi 222', N'Solymar', N'Apto'),
        (N'Melina', N'Pintos', 91234033, N'Rocha 1313', N'Ciudad de la Costa', N'Casa'),
        (N'Andres', N'Cruz', 91234034, N'Florida 98', N'El Pinar', N'Casa'),
        (N'Victoria', N'Perdomo', 91234035, N'Salto 815', N'Shangrila', N'Casa'),
        (N'Sebastian', N'Bueno', 91234036, N'Lavalleja 780', N'Lagomar', N'Trabajo'),
        (N'Manuela', N'Campos', 91234037, N'Paysandu 412', N'Solymar', N'Casa'),
        (N'Hernan', N'Gimenez', 91234038, N'Durazno 620', N'Ciudad de la Costa', N'Apto'),
        (N'Clara', N'Farias', 91234039, N'Montevideo 990', N'El Pinar', N'Casa'),
        (N'Franco', N'Barrios', 91234040, N'Maldonado 177', N'Shangrila', N'Casa');

    MERGE dbo.Clients AS target
    USING @Clients AS source
        ON target.BranchId = @BranchId AND target.Phone = source.Phone
    WHEN MATCHED THEN
        UPDATE SET Name = source.Name, LastName = source.LastName, IsDeleted = 0, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Name, LastName, Phone, BranchId, CreatedAt, IsDeleted)
        VALUES (source.Name, source.LastName, source.Phone, @BranchId, SYSUTCDATETIME(), 0);

    MERGE dbo.ClientAddresses AS target
    USING (
        SELECT c.Id AS ClientId, s.Street, s.City, N'Canelones' AS Region, 15000 AS PostalCode, N'Uruguay' AS Country, s.Label
        FROM @Clients s
        JOIN dbo.Clients c ON c.Phone = s.Phone AND c.BranchId = @BranchId AND c.IsDeleted = 0
    ) AS source
        ON target.ClientId = source.ClientId AND target.Label = source.Label
    WHEN MATCHED THEN
        UPDATE SET Street = source.Street, City = source.City, Region = source.Region,
                   PostalCode = source.PostalCode, Country = source.Country, UpdatedAt = SYSUTCDATETIME(), IsDeleted = 0
    WHEN NOT MATCHED THEN
        INSERT (Street, City, Region, PostalCode, Country, Label, ClientId, CreatedAt, IsDeleted)
        VALUES (source.Street, source.City, source.Region, source.PostalCode, source.Country, source.Label, source.ClientId, SYSUTCDATETIME(), 0);

    IF OBJECT_ID('tempdb..#ProductPool') IS NOT NULL DROP TABLE #ProductPool;
    SELECT ROW_NUMBER() OVER (ORDER BY
        CASE c.Name
            WHEN N'Hamburguesas' THEN 1
            WHEN N'Milanesas' THEN 2
            WHEN N'Pizzas' THEN 3
            WHEN N'Papas y sides' THEN 4
            WHEN N'Bebidas' THEN 5
            ELSE 6
        END, p.Id) AS RowNo,
        p.Id AS ProductId,
        p.Name,
        p.Price,
        c.Name AS CategoryName
    INTO #ProductPool
    FROM dbo.Products p
    JOIN dbo.Categories c ON c.Id = p.CategoryId
    WHERE p.BranchId = @BranchId AND p.IsDeleted = 0 AND p.IsActive = 1;

    IF OBJECT_ID('tempdb..#ClientPool') IS NOT NULL DROP TABLE #ClientPool;
    SELECT ROW_NUMBER() OVER (ORDER BY c.Id) AS RowNo,
           c.Id AS ClientId,
           a.Id AS AddressId
    INTO #ClientPool
    FROM dbo.Clients c
    JOIN dbo.ClientAddresses a ON a.ClientId = c.Id AND a.IsDeleted = 0
    WHERE c.BranchId = @BranchId AND c.IsDeleted = 0;

    DECLARE @ProductCount int = (SELECT COUNT(*) FROM #ProductPool);
    DECLARE @ClientCount int = (SELECT COUNT(*) FROM #ClientPool);
    IF @ProductCount = 0 OR @ClientCount = 0
        THROW 51001, 'No hay productos o clientes suficientes para generar pedidos.', 1;

    DECLARE @EndOperationalDate date = '2026-05-02';
    DECLARE @day int = 29;
    DECLARE @i int;
    DECLARE @ordersToday int;
    DECLARE @opDate date;
    DECLARE @localOpen datetime2(0);
    DECLARE @slot int;
    DECLARE @orderLocal datetime2(0);
    DECLARE @orderUtc datetime2(0);
    DECLARE @status nvarchar(max);
    DECLARE @payment int;
    DECLARE @clientRow int;
    DECLARE @clientId bigint;
    DECLARE @addressId bigint;
    DECLARE @orderId bigint;
    DECLARE @itemCount int;
    DECLARE @subtotal decimal(18,2);
    DECLARE @globalDiscount decimal(18,2);
    DECLARE @total decimal(18,2);
    DECLARE @note nvarchar(max);
    DECLARE @Items table (ProductId bigint, Price decimal(18,2), Quantity int, Discount decimal(18,2));

    WHILE @day >= 0
    BEGIN
        SET @opDate = DATEADD(day, -@day, @EndOperationalDate);
        SET @localOpen = DATEADD(hour, 18, CAST(@opDate AS datetime2(0)));
        SET @ordersToday =
            CASE
                WHEN @opDate = @EndOperationalDate THEN 28
                WHEN DATEPART(weekday, @opDate) IN (1, 7) THEN 18 + (ABS(CHECKSUM(@opDate)) % 8)
                WHEN DATEPART(weekday, @opDate) = 6 THEN 15 + (ABS(CHECKSUM(@opDate, 5)) % 6)
                ELSE 9 + (ABS(CHECKSUM(@opDate, 2)) % 7)
            END;

        SET @i = 1;
        WHILE @i <= @ordersToday
        BEGIN
            SET @slot = 15 + (ABS(CHECKSUM(@opDate, @i, 99)) % 455);
            SET @orderLocal = DATEADD(minute, @slot, @localOpen);
            SET @orderUtc = DATEADD(hour, 3, @orderLocal);

            IF @opDate = @EndOperationalDate AND @i > 14
                SET @status = CASE (@i % 5)
                    WHEN 0 THEN N'Pending'
                    WHEN 1 THEN N'Confirmed'
                    WHEN 2 THEN N'Cooking'
                    WHEN 3 THEN N'Ready'
                    ELSE N'OnTheWay'
                END;
            ELSE
                SET @status = CASE
                    WHEN ABS(CHECKSUM(@opDate, @i, 13)) % 24 = 0 THEN N'Cancelled'
                    ELSE N'Delivered'
                END;

            SET @payment = CASE ABS(CHECKSUM(@opDate, @i, 31)) % 10
                WHEN 0 THEN 3
                WHEN 1 THEN 3
                WHEN 2 THEN 2
                WHEN 3 THEN 2
                ELSE 1
            END;

            SET @clientRow = 1 + (ABS(CHECKSUM(@opDate, @i, 47)) % @ClientCount);
            SELECT @clientId = ClientId, @addressId = AddressId
            FROM #ClientPool
            WHERE RowNo = @clientRow;

            SET @note = @SeedTag + CASE ABS(CHECKSUM(@opDate, @i, 71)) % 9
                WHEN 0 THEN N' | Sin cebolla'
                WHEN 1 THEN N' | Tocar timbre'
                WHEN 2 THEN N' | Pago exacto'
                WHEN 3 THEN N' | Extra servilletas'
                ELSE N''
            END;

            INSERT INTO dbo.Orders (
                TrackingNumber, OrderDate, CurrentStatus, TotalAmount, Discount, Note,
                BranchId, ClientAddressId, PaymentMethod, ClientId, CreatedAt, IsDeleted
            )
            VALUES (
                NEWID(), @orderUtc, @status, 0, 0, @note,
                @BranchId, @addressId, @payment, @clientId, @orderUtc, 0
            );

            SET @orderId = SCOPE_IDENTITY();
            SET @itemCount = 1 + (ABS(CHECKSUM(@orderId, @i, 55)) % 4);

            DELETE FROM @Items;

            INSERT INTO @Items (ProductId, Price, Quantity, Discount)
            SELECT ProductId,
                   Price,
                   CASE WHEN CategoryName = N'Bebidas' THEN 1 + (ABS(CHECKSUM(@orderId, ProductId, 1)) % 3)
                        ELSE 1 + (ABS(CHECKSUM(@orderId, ProductId, 2)) % 2)
                   END AS Quantity,
                   CASE WHEN ABS(CHECKSUM(@orderId, ProductId, 3)) % 18 = 0 THEN ROUND(Price * 0.10, 0) ELSE 0 END AS Discount
            FROM (
                SELECT TOP (@itemCount) ProductId, Price, CategoryName, RowNo
                FROM #ProductPool
                ORDER BY ABS(CHECKSUM(@orderId, RowNo))
            ) picked;

            INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice, Observation, Discount, CreatedAt, IsDeleted)
            SELECT @orderId,
                   ProductId,
                   Quantity,
                   Price,
                   CASE WHEN ABS(CHECKSUM(@orderId, ProductId, 8)) % 14 = 0 THEN N'Sin sal' ELSE N'' END,
                   Discount,
                   @orderUtc,
                   0
            FROM @Items;

            SELECT @subtotal = SUM((Price * Quantity) - Discount) FROM @Items;
            SET @globalDiscount = CASE WHEN ABS(CHECKSUM(@orderId, 88)) % 14 = 0 THEN ROUND(@subtotal * 0.08, 0) ELSE 0 END;
            SET @total = @subtotal - @globalDiscount;

            UPDATE dbo.Orders
            SET TotalAmount = @total, Discount = @globalDiscount
            WHERE Id = @orderId;

            INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
            VALUES (@orderId, 1, @orderUtc, @MauroUserId, @orderUtc, 0);

            IF @status IN (N'Confirmed', N'Cooking', N'Ready', N'OnTheWay', N'Delivered')
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 2, DATEADD(minute, 4 + ABS(CHECKSUM(@orderId, 2)) % 6, @orderUtc), @MauroUserId, @orderUtc, 0);

            IF @status IN (N'Cooking', N'Ready', N'OnTheWay', N'Delivered')
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 3, DATEADD(minute, 12 + ABS(CHECKSUM(@orderId, 3)) % 10, @orderUtc), @KitchenUserId, @orderUtc, 0);

            IF @status IN (N'Ready', N'OnTheWay', N'Delivered')
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 4, DATEADD(minute, 28 + ABS(CHECKSUM(@orderId, 4)) % 16, @orderUtc), @KitchenUserId, @orderUtc, 0);

            IF @status IN (N'OnTheWay', N'Delivered')
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 6, DATEADD(minute, 42 + ABS(CHECKSUM(@orderId, 6)) % 12, @orderUtc), @DeliveryUserId, @orderUtc, 0);

            IF @status = N'Delivered'
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 5, DATEADD(minute, 58 + ABS(CHECKSUM(@orderId, 5)) % 28, @orderUtc), @DeliveryUserId, @orderUtc, 0);

            IF @status = N'Cancelled'
                INSERT INTO dbo.OrderStatusHistories (OrderId, Status, ChangeDate, ChangedByUserId, CreatedAt, IsDeleted)
                VALUES (@orderId, 0, DATEADD(minute, 7 + ABS(CHECKSUM(@orderId, 0)) % 18, @orderUtc), @MauroUserId, @orderUtc, 0);

            SET @i += 1;
        END;

        SET @day -= 1;
    END;

    DECLARE @sessionDay int = 29;
    DECLARE @openUtc datetime2(0);
    DECLARE @closeUtc datetime2(0);
    DECLARE @initial decimal(18,2);
    DECLARE @cashSales decimal(18,2);
    DECLARE @inMov decimal(18,2);
    DECLARE @outMov decimal(18,2);
    DECLARE @expected decimal(18,2);
    DECLARE @final decimal(18,2);
    DECLARE @diff decimal(18,2);
    DECLARE @cashSessionId bigint;

    WHILE @sessionDay >= 1
    BEGIN
        SET @opDate = DATEADD(day, -@sessionDay, @EndOperationalDate);
        SET @openUtc = DATEADD(hour, 21, CAST(@opDate AS datetime2(0)));
        SET @closeUtc = DATEADD(minute, 8 + ABS(CHECKSUM(@opDate, 201)) % 30, DATEADD(hour, 5, DATEADD(day, 1, CAST(@opDate AS datetime2(0)))));
        SET @initial = 1800 + (ABS(CHECKSUM(@opDate, 202)) % 9) * 100;

        SELECT @cashSales = COALESCE(SUM(TotalAmount), 0)
        FROM dbo.Orders
        WHERE BranchId = @BranchId
          AND Note LIKE N'%' + @SeedTag + N'%'
          AND CurrentStatus = N'Delivered'
          AND PaymentMethod = 1
          AND OrderDate >= @openUtc
          AND OrderDate <= @closeUtc;

        SET @inMov = CASE WHEN ABS(CHECKSUM(@opDate, 203)) % 4 = 0 THEN 500 ELSE 0 END;
        SET @outMov = CASE WHEN ABS(CHECKSUM(@opDate, 204)) % 3 = 0 THEN 350 + (ABS(CHECKSUM(@opDate, 205)) % 5) * 70 ELSE 0 END;
        SET @expected = @initial + @cashSales + @inMov - @outMov;
        SET @diff = CASE ABS(CHECKSUM(@opDate, 206)) % 7
            WHEN 0 THEN -80
            WHEN 1 THEN -40
            WHEN 2 THEN 50
            ELSE 0
        END;
        SET @final = @expected + @diff;

        INSERT INTO dbo.CashSessions (OpenTime, CloseTime, OperationalDate, InitialBalance, FinalBalance, ExpectedBalance, Difference, Notes, IsClosed, CreatedAt, IsDeleted)
        VALUES (@openUtc, @closeUtc, DATEADD(hour, 3, CAST(@opDate AS datetime2(0))), @initial, @final, @expected, @diff, @SeedTag + N' | cierre automatico demo', 1, @openUtc, 0);

        SET @cashSessionId = SCOPE_IDENTITY();

        IF @inMov > 0
            INSERT INTO dbo.CashMovements (CashSessionId, Type, Amount, Description, MovementDate, CreatedAt, IsDeleted)
            VALUES (@cashSessionId, N'IN', @inMov, N'Refuerzo de caja', DATEADD(hour, 1, @openUtc), DATEADD(hour, 1, @openUtc), 0);

        IF @outMov > 0
            INSERT INTO dbo.CashMovements (CashSessionId, Type, Amount, Description, MovementDate, CreatedAt, IsDeleted)
            VALUES (@cashSessionId, N'OUT', @outMov, N'Compra rapida de insumos', DATEADD(hour, 3, @openUtc), DATEADD(hour, 3, @openUtc), 0);

        SET @sessionDay -= 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.CashSessions WHERE IsClosed = 0 AND IsDeleted = 0)
    BEGIN
        SET @opDate = @EndOperationalDate;
        SET @openUtc = DATEADD(hour, 21, CAST(@opDate AS datetime2(0)));
        INSERT INTO dbo.CashSessions (OpenTime, CloseTime, OperationalDate, InitialBalance, FinalBalance, ExpectedBalance, Difference, Notes, IsClosed, CreatedAt, IsDeleted)
        VALUES (@openUtc, NULL, DATEADD(hour, 3, CAST(@opDate AS datetime2(0))), 2500, NULL, NULL, NULL, @SeedTag + N' | caja abierta para pruebas', 0, @openUtc, 0);

        SET @cashSessionId = SCOPE_IDENTITY();
        INSERT INTO dbo.CashMovements (CashSessionId, Type, Amount, Description, MovementDate, CreatedAt, IsDeleted)
        VALUES
            (@cashSessionId, N'OUT', 420, N'Compra de hielo', DATEADD(hour, 2, @openUtc), DATEADD(hour, 2, @openUtc), 0),
            (@cashSessionId, N'OUT', 290, N'Envases descartables', DATEADD(hour, 4, @openUtc), DATEADD(hour, 4, @openUtc), 0);
    END;

    UPDATE bs
    SET CurrentStock = CASE i.Name
            WHEN N'Queso azul' THEN 1.25
            WHEN N'Papas rusticas' THEN 10.50
            WHEN N'Cerveza lata' THEN 17.00
            WHEN N'Cheesecake porcion' THEN 7.00
            ELSE bs.CurrentStock
        END,
        UpdatedAt = SYSUTCDATETIME()
    FROM dbo.BranchStocks bs
    JOIN dbo.Ingredients i ON i.Id = bs.IngredientId
    WHERE bs.BranchId = @BranchId
      AND i.Name IN (N'Queso azul', N'Papas rusticas', N'Cerveza lata', N'Cheesecake porcion');

    COMMIT;

    SELECT 'BranchId' AS Metric, CAST(@BranchId AS nvarchar(40)) AS Value
    UNION ALL SELECT 'Products', CAST(COUNT(*) AS nvarchar(40)) FROM dbo.Products WHERE BranchId = @BranchId AND IsDeleted = 0
    UNION ALL SELECT 'Ingredients', CAST(COUNT(*) AS nvarchar(40)) FROM dbo.Ingredients WHERE BranchId = @BranchId AND IsDeleted = 0
    UNION ALL SELECT 'Clients', CAST(COUNT(*) AS nvarchar(40)) FROM dbo.Clients WHERE BranchId = @BranchId AND IsDeleted = 0
    UNION ALL SELECT 'OrdersSeeded', CAST(COUNT(*) AS nvarchar(40)) FROM dbo.Orders WHERE BranchId = @BranchId AND Note LIKE N'%' + @SeedTag + N'%'
    UNION ALL SELECT 'OpenCashSessions', CAST(COUNT(*) AS nvarchar(40)) FROM dbo.CashSessions WHERE IsClosed = 0 AND IsDeleted = 0;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
