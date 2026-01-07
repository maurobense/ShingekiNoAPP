using ShingekiNoAPPI.Hubs; // ⚠️ Asegúrate de que este namespace exista (tu carpeta Hubs)
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
// 🌍 1. CONFIGURACIÓN DE CORS (SOLUCIÓN SIGNALR)
// =========================================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.SetIsOriginAllowed(origin => true) // Permite cualquier origen (clave para SignalR)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials(); // SignalR REQUIERE credenciales
        });
});

// =========================================================
// ⚙️ 2. SERVICIOS
// =========================================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession();

// ✅ AGREGAMOS EL SERVICIO DE SIGNALR
builder.Services.AddSignalR();

// Base de Datos
builder.Services.AddDbContext<ShingekiContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MiConexion")));

// =========================================================
// 💉 3. INYECCIÓN DE DEPENDENCIAS (REPOSITORIOS)
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
// Esto fuerza a mostrar el error real en Somee si algo falla (en vez de pantalla blanca)
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

// ⚠️ EL ORDEN ES CRÍTICO:
// 1. CORS
// 2. Auth (Quién eres)
// 3. Authz (Qué permisos tienes)
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.UseSession();

app.MapControllers();

// ✅ MAPEO DEL HUB DE SIGNALR
app.MapHub<DeliveryHub>("/deliveryHub");

app.Run();