using System.Text.Json;

namespace Afterhours.Uno.Services;

// Game state the XAML reads. Phase A reads it from the JavaScript game; Phase B swaps in C# rules.
public interface IGameStore
{
    IAsyncEnumerable<Hud> WatchHud(CancellationToken ct);

    IAsyncEnumerable<Portrait> WatchPortrait(CancellationToken ct);

    bool TryGetSlice(string key, out JsonElement value);
}
