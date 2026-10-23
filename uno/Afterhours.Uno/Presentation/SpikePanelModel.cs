namespace Afterhours.Uno.Presentation;

// WAVE 0 SPIKE: proves a "!" route opens a flyout page over the hosted room.
public partial record SpikePanelModel
{
    public IState<int> Clicks => State.Value(this, () => 0);

    public async ValueTask Count(CancellationToken ct) => await Clicks.UpdateAsync(n => n + 1, ct);
}
