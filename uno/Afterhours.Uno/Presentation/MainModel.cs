using System.Collections.Immutable;
using System.Runtime.CompilerServices;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record RoomStop(PublicRoom Room, bool Current);

public sealed partial record ChatMode(string Id, string Name);

public partial record MainModel(IGameStore Store, IRoomView RoomView)
{
    public ImmutableList<ChatMode> ChatModes { get; } = [new("say", "Say"), new("shout", "Shout"), new("whisper", "Whisper")];

    public IFeed<BridgeStatus> Status => Feed.AsyncEnumerable(RoomView.WatchStatus);

    public IFeed<Hud> Hud => Feed.AsyncEnumerable(Store.WatchHud);

    public IFeed<Portrait> Portrait => Feed.AsyncEnumerable(Store.WatchPortrait);

    public IFeed<Chrome> Chrome => Feed.AsyncEnumerable(RoomView.WatchChrome);

    public IListFeed<RoomStop> RoomStops => ListFeed.AsyncEnumerable(Stops);

    public IListFeed<ChatLine> ChatLines => ListFeed.AsyncEnumerable(Lines);

    public IListFeed<WhisperTarget> WhisperTargets => ListFeed.AsyncEnumerable(Targets);

    public IState<string> Message => State<string>.Value(this, () => "");

    public IState<string> Mode => State<string>.Value(this, () => "say");

    // "" until a whisper target is picked, so Send always receives a value for it.
    public IState<string> WhisperTarget => State<string>.Value(this, () => "");

    public IFeed<bool> IsWhisper => Mode.Select(mode => mode == "whisper");

    // Runs a command from host.mjs's allowlist (XAML passes the name as CommandParameter).
    public void Run(string command) => RoomView.Run(command);

    public void Travel(RoomStop stop) => RoomView.Travel(stop.Room.Index);

    // text is the command parameter: TextBox.Text from Enter (utu:CommandExtensions) or from the Send button.
    public async ValueTask Send(string text, string mode, string whisperTarget, CancellationToken ct)
    {
        if (RoomView.Say(text, mode, whisperTarget))
            await Message.UpdateAsync(_ => "", ct);
    }

    public void Retry() => RoomView.Reload();

    public Task Mount(string elementId) => RoomView.MountAsync(elementId);

    private async IAsyncEnumerable<IImmutableList<RoomStop>> Stops([EnumeratorCancellation] CancellationToken ct)
    {
        var rooms = ImmutableList<PublicRoom>.Empty;
        Chrome? chrome = null;
        // Rooms arrive once at ready; the current stop follows the room the game reports.
        await foreach (var list in RoomView.WatchPublicRooms(ct))
        {
            rooms = list;
            break;
        }
        await foreach (var next in RoomView.WatchChrome(ct))
        {
            if (chrome is not null && chrome.Room.Key == next.Room.Key)
                continue;
            chrome = next;
            yield return rooms.Select(r => new RoomStop(r, !next.Room.Personal && next.Room.Key == "public:" + r.Index)).ToImmutableList();
        }
    }

    private async IAsyncEnumerable<IImmutableList<ChatLine>> Lines([EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chat in RoomView.WatchChat(ct))
            yield return chat.Lines;
    }

    private async IAsyncEnumerable<IImmutableList<WhisperTarget>> Targets([EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chat in RoomView.WatchChat(ct))
            yield return chat.WhisperTargets;
    }
}
