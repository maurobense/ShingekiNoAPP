using ShingekiNoAPPI.Hubs; // ⚠️ ASEGÚRATE QUE ESTE NAMESPACE COINCIDA CON DONDE CREASTE DeliveryHub.cs
using Business.RepositoryInterfaces;
using Datos.EF;
using Datos.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ⚠️ Clave Secreta para JWT
var claveSecreta = "ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=";

// =========================================================
// 🌍 CONFIGURACIÓN DE CORS (ADAPTADO PARA SIGNALR)
// =========================================================
// SignalR requiere 'AllowCredentials' para funcionar bien, lo cual choca con 'AllowAnyOrigin'.
// Usamos 'SetIsOriginAllowed(_ => true)' como truco para permitir todo + credenciales.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.SetIsOriginAllowed(origin => true) // Permite cualquier origen dinámicamente
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials(); // ⚠️ OBLIGATORIO para SignalR
        });
});

// =========================================================
// ⚙️ SERVICIOS DE INFRAESTRUCTURA Y JSON
// =========================================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // ✅ FIX 1: Enums como Strings en los JSON
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());

        // ✅ FIX 2: Ignorar referencias circulares
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession();

// ✅ NUEVO: Servicio de SignalR
builder.Services.AddSignalR();

// --- Configuración de la Base de Datos ---
builder.Services.AddDbContext<ShingekiContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MiConexion")));

// =========================================================
// 💉 INYECCIÓN DE DEPENDENCIAS (REPOSITORIOS)
// =========================================================

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


// --- Configuración de Seguridad JWT ---
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
    });


var app = builder.Build();

// =========================================================
// 🛣️ CONFIGURACIÓN DEL PIPELINE HTTP
// =========================================================

// if (app.Environment.IsDevelopment()) 
// {
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "ShingekiNoAPPI v1");
    c.RoutePrefix = "swagger";
});
// }

app.UseHttpsRedirection();

// ⚠️ IMPORTANTE: CORS debe ir antes de Auth y SignalR
app.UseCors("AllowAll");

// Seguridad
app.UseAuthentication();
app.UseAuthorization();

app.UseSession();

app.MapControllers();

// ✅ NUEVO: Endpoint para el Hub de SignalR
// Asegúrate de que el frontend apunte a "https://tu-url.com/deliveryHub"
app.MapHub<DeliveryHub>("/deliveryHub");

app.Run();