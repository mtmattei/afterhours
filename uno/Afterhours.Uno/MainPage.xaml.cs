using System.Diagnostics;
using System.Text.Json;
using Afterhours.Uno.Interop;

namespace Afterhours.Uno;

// WAVE 0 SPIKE: proves same-page hosting, the C#/JS round trip, overlays, audio and fonts. Replaced in wave 1.
public sealed partial class MainPage : Page
{
    private int _flyoutClicks;

    public MainPage()
    {
        this.InitializeComponent();
        Loaded += async (_, _) => await OpenGameAsync();
    }

    private async Task OpenGameAsync()
    {
        if (!OperatingSystem.IsBrowser() || Room.Element is null)
            return;
        try
        {
            var url = global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("new URL('game/host.js', document.baseURI).href");
            await GameHost.ImportAsync(url);
            await GameHost.Mount(Room.Element.ElementId, OnGameEvent);
        }
        catch (Exception e)
        {
            LoadingMessage.Text = "Your world could not load: " + e.Message;
            LoadingRing.IsIndeterminate = false;
            Console.WriteLine("AH_SPIKE mount failed " + e);
        }
    }

    private void OnGameEvent(string json)
    {
        var watch = Stopwatch.StartNew();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        switch (root.GetProperty("type").GetString())
        {
            case "ready":
                LoadingPanel.Visibility = Visibility.Collapsed;
                Console.WriteLine("AH_SPIKE ready scripts=" + root.GetProperty("scripts").GetInt32());
                break;
            case "state":
                var coins = root.GetProperty("state").GetProperty("coins").GetInt32();
                watch.Stop();
                CoinsText.Text = "✦ " + coins;
                Console.WriteLine($"AH_SPIKE state bytes={json.Length} parseMs={watch.Elapsed.TotalMilliseconds:F2} coins={coins}");
                break;
        }
    }

    private void Gift_Click(object sender, RoutedEventArgs e)
    {
        if (!OperatingSystem.IsBrowser())
            return;
        using var reply = JsonDocument.Parse(GameHost.Dispatch("checkin", "{}"));
        SpikeStatus.Text = reply.RootElement.GetProperty("ok").GetBoolean()
            ? "Gift claimed"
            : reply.RootElement.GetProperty("error").GetString();
    }

    private async void Play_Click(object sender, RoutedEventArgs e)
    {
        if (!OperatingSystem.IsBrowser())
            return;
        await GameHost.PlayDraft();
        SpikeStatus.Text = "Playing";
    }

    private void FlyoutAction_Click(object sender, RoutedEventArgs e) => SpikeStatus.Text = "Flyout clicks " + ++_flyoutClicks;

    private void Flyout_Closed(object sender, object e)
    {
        if (OperatingSystem.IsBrowser())
            GameHost.FocusRoom();
    }
}
