using System.Text.Json;

namespace Afterhours.Uno.Services;

// Game state the XAML reads. Phase A reads it from the JavaScript game; Phase B swaps in C# rules.
public interface IGameStore
{
    IAsyncEnumerable<Hud> WatchHud(CancellationToken ct);

    IAsyncEnumerable<Portrait> WatchPortrait(CancellationToken ct);

    bool TryGetSlice(string key, out JsonElement value);

    IAsyncEnumerable<ShopData> WatchShop(CancellationToken ct);

    IAsyncEnumerable<Inventory> WatchInventory(CancellationToken ct);

    // Writes. Each runs the game's own action; a failed reply carries the game's message.
    ActionReply Buy(string type);

    Task<ActionReply> Place(string itemId);

    ActionReply Use(string itemId);

    ActionReply Wrap(string giftId, string contentId, string note);

    ActionReply SaveBlueprint();

    ActionReply RestoreBlueprint(string blueprintId);

    ActionReply PlayDisc(string discId);
}
