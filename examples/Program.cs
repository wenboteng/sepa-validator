// Validate one file with HttpClient. No extra packages. .NET 6+.
//   dotnet new console -n SepaCheck
//   copy this file over Program.cs, then: dotnet run -- path/to/pain001.xml
using System.Net.Http.Headers;
using System.Text.Json;

if (args.Length != 1)
{
    Console.Error.WriteLine("usage: SepaCheck FILE");
    return 2;
}

var path = args[0];
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
using var form = new MultipartFormDataContent();
await using var stream = File.OpenRead(path);
using var file = new StreamContent(stream);
file.Headers.ContentType = new MediaTypeHeaderValue("application/xml");
form.Add(file, "file", Path.GetFileName(path));

using var response = await http.PostAsync("https://checksepa.com/v1/validate", form);
var body = await response.Content.ReadAsStringAsync();
Console.WriteLine(body);
if (!response.IsSuccessStatusCode)
{
    return 1;
}
using var document = JsonDocument.Parse(body);
var valid = document.RootElement.TryGetProperty("valid", out var flag) && flag.ValueKind == JsonValueKind.True;
return valid ? 0 : 1;
