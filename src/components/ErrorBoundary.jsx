import { Component } from 'react'

// The one class component in the codebase: React only exposes error boundaries
// through a class, there is no hook equivalent. Without a boundary, any error
// escaping a render or effect unmounts the entire root — the app becomes a
// blank page with no way back but knowing to hard-reload. This keeps a crash
// contained to the tab it happened in, with the tab bar still alive.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
