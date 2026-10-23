using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace Afterhours.Uno.Interop;

// The only C# that calls the game's JavaScript. Functions live in game/host.js.
[SupportedOSPlatform("browser")]
internal static partial class GameHost
{
    private const string Module = "afterhours";

    public static Task ImportAsync(string url) => JSHost.ImportAsync(Module, url);

    [JSImport("mount", Module)]
    public static partial Task Mount(string elementId, [JSMarshalAs<JSType.Function<JSType.String>>] Action<string> onEvent);

    [JSImport("dispatch", Module)]
    public static partial string Dispatch(string type, string payloadJson);

    [JSImport("playDraft", Module)]
    public static partial Task PlayDraft();

    [JSImport("stopMusic", Module)]
    public static partial void StopMusic();

    [JSImport("focusRoom", Module)]
    public static partial void FocusRoom();
}
