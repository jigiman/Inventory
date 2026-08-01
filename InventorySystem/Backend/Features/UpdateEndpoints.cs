using System;
using Backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Backend.Features;

public static class UpdateEndpoints
{
    public static void MapUpdateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/updater");

        // GET /api/updater/status
        group.MapGet("/status", (UpdateService updateService) =>
        {
            return Results.Ok(updateService.GetStatus());
        });

        // POST /api/updater/check
        group.MapPost("/check", async (UpdateService updateService) =>
        {
            var status = await updateService.CheckForUpdatesAsync();
            return Results.Ok(status);
        });

        // POST /api/updater/download
        group.MapPost("/download", async (UpdateService updateService) =>
        {
            var status = await updateService.DownloadUpdateAsync();
            return Results.Ok(status);
        });

        // POST /api/updater/apply
        group.MapPost("/apply", (UpdateService updateService) =>
        {
            try
            {
                updateService.RestartAndApplyUpdate();
                return Results.Ok(new { message = "Restarting to apply update..." });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }
}
