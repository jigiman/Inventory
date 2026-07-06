using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Backend.Features;

public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var arg = context.Arguments.FirstOrDefault(a => a is T) as T;
        if (arg == null)
        {
            return Results.BadRequest(new { error = $"Request payload of type {typeof(T).Name} is required." });
        }

        var validationContext = new ValidationContext(arg);
        var validationResults = new List<ValidationResult>();

        if (!Validator.TryValidateObject(arg, validationContext, validationResults, validateAllProperties: true))
        {
            var errors = new Dictionary<string, string[]>();
            foreach (var result in validationResults)
            {
                var key = result.MemberNames.FirstOrDefault() ?? "Error";
                var message = result.ErrorMessage ?? "Invalid value";
                
                if (errors.TryGetValue(key, out var existing))
                {
                    var updated = new List<string>(existing) { message };
                    errors[key] = updated.ToArray();
                }
                else
                {
                    errors[key] = new[] { message };
                }
            }
            return Results.ValidationProblem(errors);
        }

        return await next(context);
    }
}
