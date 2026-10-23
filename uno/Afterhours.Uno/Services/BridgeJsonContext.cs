using System.Text.Json.Serialization;

namespace Afterhours.Uno.Services;

// Source-generated so parsing survives trimming in the WebAssembly publish.
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Hud))]
[JsonSerializable(typeof(Portrait))]
[JsonSerializable(typeof(Chrome))]
[JsonSerializable(typeof(ChatState))]
[JsonSerializable(typeof(ReadyEvent))]
internal sealed partial class BridgeJsonContext : JsonSerializerContext;
