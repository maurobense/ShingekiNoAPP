using ShingekiNoAPPI.Hubs;
using Business.RepositoryInterfaces;
using Business.BusinessInterfaces;
using Datos.EF;
using Datos.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using ShingekiNoAPPI.Services;
using Amazon;
using Amazon.S3;
using ShingekiNoAPPI.Options;
using ShingekiNoAPPI.Services.Storage;

var builder = WebApplication.CreateBuilder(args);

// ⚠️ Clave Secreta para JWT
var claveSecreta = "ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=";

// =========================================================
// 🌍 1. CONFIGURACIÓN DE CORS (SOLUCIÓN SIGNALR)
// =========================================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.SetIsOriginAllowed(origin => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        });
});

// =========================================================
// ⚙️ 2. SERVICIOS
// =========================================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        // 🔥 ACÁ ESTÁ LA MAGIA QUE SALVA LA MEMORIA DE SOMEE
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession();

// ✅ AGREGAMOS EL SERVICIO DE SIGNALR
builder.Services.AddSignalR();

builder.Services.Configure<S3StorageOptions>(builder.Configuration.GetSection("S3"));
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var regionName = configuration["S3:Region"] ?? "us-east-1";
    return new AmazonS3Client(RegionEndpoint.GetBySystemName(regionName));
});
builder.Services.AddScoped<IFileStorageService, S3FileStorageService>();

// Base de Datos
builder.Services.AddDbContext<ShingekiContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MiConexion")));

// =========================================================
// 💉 3. INYECCIÓN DE DEPENDENCIAS (REPOSITORIOS Y TENANT)
// =========================================================

// --- SERVICIOS BASE PARA MULTI-TENANT ---
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, TenantService>();

// --- 1. Actores y Sucursales ---
builder.Services.AddScoped<IRepositoryUser, RepositoryUser>();
builder.Services.AddScoped<IRepositoryClient, RepositoryClient>();
builder.Services.AddScoped<IRepositoryBranch, RepositoryBranch>();
builder.Services.AddScoped<IRepositoryClientAddress, RepositoryClientAddress>();

// --- 2. Catálogo e Inventario ---
builder.Services.AddScoped<IRepositoryProduct, RepositoryProduct>();
builder.Services.AddScoped<IRepositoryCategory, RepositoryCategory>();
builder.Services.AddScoped<IRepositoryIngredient, RepositoryIngredient>();
builder.Services.AddScoped<IRepositoryProductIngredient, RepositoryProductIngredient>();
builder.Services.AddScoped<IRepositoryBranchStock, RepositoryBranchStock>();

// --- 3. Ventas y Logística ---
builder.Services.AddScoped<IRepositoryOrder, RepositoryOrder>();
builder.Services.AddScoped<IRepositoryOrderItem, RepositoryOrderItem>();
builder.Services.AddScoped<IRepositoryOrderStatusHistory, RepositoryOrderStatusHistory>();


// =========================================================
// 🔐 4. SEGURIDAD JWT + SIGNALR
// =========================================================
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(claveSecreta)),
            ValidateIssuer = false,
            ValidateAudience = false
        };

        // 🔥 LÓGICA PARA LEER TOKEN DESDE URL (SIGNALR)
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                // Si viene un token y la ruta es hacia el Hub
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/deliveryHub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });


var app = builder.Build();

// =========================================================
// 🚨 MANEJO DE ERRORES (IMPORTANTE PARA DEBUG)
// =========================================================
app.UseDeveloperExceptionPage();

// =========================================================
// 🛣️ 5. PIPELINE HTTP
// =========================================================

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "ShingekiNoAPPI v1");
    c.RoutePrefix = "swagger";
});

app.UseHttpsRedirection();

// ⚠️ EL ORDEN ES CRÍTICO
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.UseSession();

app.MapControllers();

// ✅ MAPEO DEL HUB DE SIGNALR
app.MapHub<DeliveryHub>("/deliveryHub");

app.Run();
