using System.Collections.Immutable;
using System.Runtime.Versioning;
using System.Text.Json;
using Afterhours.Uno.Interop;

namespace Afterhours.Uno.Services;

// Phase A: both interfaces are backed by the JavaScript game running in the same page.
[SupportedOSPlatform("browser")]
public sealed class JsGame(GameEvents events) : IGameStore, IRoomView
{
    private static readonly TimeSpan OpenTimeout = TimeSpan.FromSeconds(15);
    private bool _mounted;

    public IAsyncEnumerable<Hud> WatchHud(CancellationToken ct) => events.Hud.Watch(ct);

    public IAsyncEnumerable<Portrait> WatchPortrait(CancellationToken ct) => events.Portrait.Watch(ct);

    public bool TryGetSlice(string key, out JsonElement value) => events.TryGetSlice(key, out value);

    public IAsyncEnumerable<BridgeStatus> WatchStatus(CancellationToken ct) => events.Status.Watch(ct);

    public IAsyncEnumerable<ImmutableList<PublicRoom>> WatchPublicRooms(CancellationToken ct) => events.PublicRooms.Watch(ct);

    public IAsyncEnumerable<Chrome> WatchChrome(CancellationToken ct) => events.Chrome.Watch(ct);

    public IAsyncEnumerable<ChatState> WatchChat(CancellationToken ct) => events.Chat.Watch(ct);

    public async Task MountAsync(string elementId)
    {
        if (_mounted)
            return;
        _mounted = true;
        try
        {
            var url = global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("new URL('game/host.mjs', document.baseURI).href");
            await GameHost.ImportAsync(url);
            var mount = GameHost.Mount(elementId, events.Receive);
            if (await Task.WhenAny(mount, Task.Delay(OpenTimeout)) != mount)
                throw new TimeoutException("Your world took too long to open.");
            await mount;
        }
        catch (Exception e)
        {
            events.Fail(e);
        }
    }

    public bool Run(string command) => _mounted && GameHost.Invoke(command);

    public bool Travel(int index) => _mounted && GameHost.Travel(index);

    public bool Say(string text, string mode, string? target) => _mounted && GameHost.Say(text, mode, target ?? "");

    public void Focus()
    {
        if (_mounted)
            GameHost.FocusRoom();
    }

    public void Reload() => global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("location.reload()");
}
