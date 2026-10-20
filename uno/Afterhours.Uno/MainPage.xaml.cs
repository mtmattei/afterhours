namespace Afterhours.Uno;

public sealed partial class MainPage : Page
{
    public MainPage()
    {
        this.InitializeComponent();
        Loaded += async (_, _) => await OpenGameAsync();
    }

    private async Task OpenGameAsync()
    {
        LoadingPanel.Visibility = Visibility.Visible;
        LoadingRing.IsIndeterminate = true;
        RetryButton.Visibility = Visibility.Collapsed;
        LoadingMessage.Text = "Opening your world…";
        try
        {
            await GameView.EnsureCoreWebView2Async();
            GameView.NavigationCompleted -= GameView_NavigationCompleted;
            GameView.NavigationCompleted += GameView_NavigationCompleted;
            var address = global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("new URL('game/index.html', document.baseURI).href");
            GameView.Source = new Uri(address);
        }
        catch (Exception)
        {
            ShowRetry();
        }
    }

    private void GameView_NavigationCompleted(WebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs args)
    {
        LoadingRing.IsIndeterminate = false;
        if (args.IsSuccess)
            LoadingPanel.Visibility = Visibility.Collapsed;
        else
            ShowRetry();
    }

    private void ShowRetry()
    {
        LoadingMessage.Text = "Your world could not load. Check your connection and try again.";
        LoadingRing.IsIndeterminate = false;
        RetryButton.Visibility = Visibility.Visible;
    }

    private async void Retry_Click(object sender, RoutedEventArgs e) => await OpenGameAsync();
}
