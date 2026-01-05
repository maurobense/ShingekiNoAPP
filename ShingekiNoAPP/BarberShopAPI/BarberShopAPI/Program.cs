using Business.RepositoryInterfaces;
using Datos.EF;
using Datos.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization; // Necesario para Enums y IgnoreCycles

var builder = WebApplication.CreateBuilder(args);

// ⚠️ Clave Secreta para JWT
var claveSecreta = "ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=";

// =========================================================
// 🌍 CONFIGURACIÓN DE CORS (CORREGIDO: MODO "PERMITIR TODO")
// =========================================================
// Esto permite que CUALQUIER origen (tu frontend local, postman, celular) acceda a la API.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.AllowAnyOrigin()  // Permite 127.0.0.1, localhost, vercel, etc.
                  .AllowAnyMethod()  // Permite GET, POST, PUT, DELETE, etc.
                  .AllowAnyHeader(); // Permite Authorization, Content-Type, etc.
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

        // ✅ FIX 2: Ignorar referencias circulares (Evita error de profundidad 32)
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession();

// --- Configuración de la Base de Datos ---
// Recuerda que en Somee esto se sobrescribe con el appsettings.json, pero déjalo así.
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

// ⚠️ FIX: Comentamos el 'if' para que Swagger funcione en Producción (Somee)
// if (app.Environment.IsDevelopment()) 
// {
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    // Ajuste ruta para que funcione bien en la raíz o subcarpetas
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "ShingekiNoAPPI v1");
    c.RoutePrefix = "swagger"; // Accesible en /swagger
});
// }

app.UseHttpsRedirection();

// ⚠️ IMPORTANTE: Aplicamos la política "AllowAll" que definimos arriba
app.UseCors("AllowAll");

// Seguridad
app.UseAuthentication();
app.UseAuthorization();

app.UseSession();

app.MapControllers();

app.Run();