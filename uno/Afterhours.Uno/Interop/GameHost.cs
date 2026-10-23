using System.Runtime.InteropServices.JavaScript;

namespace Afterhours.Uno.Interop;

// The only C# that calls the game's JavaScript. Functions live in game/host.mjs.
[System.Runtime.Versioning.SupportedOSPlatform("browser")]
internal static partial class GameHost
{
    private const string Module = "afterhours";

    public static Task ImportAsync(string url) => JSHost.ImportAsync(Module, url);

    [JSImport("mount", Module)]
    public static partial Task Mount(string elementId, [JSMarshalAs<JSType.Function<JSType.String>>] Action<string> onEvent);

    [JSImport("invoke", Module)]
    public static partial bool Invoke(string command);

    [JSImport("travel", Module)]
    public static partial bool Travel(int index);

    [JSImport("say", Module)]
    public static partial bool Say(string text, string mode, string target);

    [JSImport("focusRoom", Module)]
    public static partial void FocusRoom();

    // Writes reply with {ok, error, result} as JSON.
    [JSImport("buy", Module)]
    public static partial string Buy(string type);

    [JSImport("place", Module)]
    public static partial Task<string> Place(string itemId);

    [JSImport("use", Module)]
    public static partial string Use(string itemId);

    [JSImport("wrap", Module)]
    public static partial string Wrap(string giftId, string contentId, string note);

    [JSImport("saveBlueprint", Module)]
    public static partial string SaveBlueprint();

    [JSImport("restoreBlueprint", Module)]
    public static partial string RestoreBlueprint(string blueprintId);

    [JSImport("playDisc", Module)]
    public static partial string PlayDisc(string discId);
}
