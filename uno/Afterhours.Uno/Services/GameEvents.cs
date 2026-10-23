using System.Collections.Immutable;
using System.Text.Json;

namespace Afterhours.Uno.Services;

// Turns host.mjs events into the latest values the app shows. Pure .NET, so it is unit-tested.
public sealed class GameEvents
{
    private readonly Dictionary<string, JsonElement> _slices = [];

    public Latest<BridgeStatus> Status { get; } = new();
    public Latest<ImmutableList<PublicRoom>> PublicRooms { get; } = new();
    public Latest<Hud> Hud { get; } = new();
    public Latest<Portrait> Portrait { get; } = new();
    public Latest<Chrome> Chrome { get; } = new();
    public Latest<ChatState> Chat { get; } = new();

    public bool TryGetSlice(string key, out JsonElement value) => _slices.TryGetValue(key, out value);

    public void Receive(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var ctx = BridgeJsonContext.Default;
        switch (root.GetProperty("type").GetString())
        {
            case "ready":
                PublicRooms.Set(root.Deserialize(ctx.ReadyEvent)!.PublicRooms);
                Status.Set(new BridgeStatus(true));
                break;
            case "slices":
                foreach (var slice in root.GetProperty("slices").EnumerateObject())
                    _slices[slice.Name] = slice.Value.Clone();
                break;
            case "hud":
                Hud.Set(root.GetProperty("hud").Deserialize(ctx.Hud)!);
                break;
            case "portrait":
                Portrait.Set(root.Deserialize(ctx.Portrait)!);
                break;
            case "chrome":
                Chrome.Set(root.GetProperty("chrome").Deserialize(ctx.Chrome)!);
                break;
            case "chat":
                Chat.Set(root.GetProperty("chat").Deserialize(ctx.ChatState)!);
                break;
        }
    }

    public void Fail(Exception error)
    {
        Status.Fail(error);
        Hud.Fail(error);
    }
}
