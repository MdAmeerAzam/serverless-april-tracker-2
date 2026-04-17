import React, { useState, useEffect } from 'react';
import { Activity, Clock, BarChart2, TrendingUp } from 'lucide-react';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('4h'); 
  const [market, setMarket] = useState('spot'); // 'spot' or 'futures'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Unified data endpoint
        const endpoint = `/api/data?tracker=bitcoin&asset=btc&market=${market}&interval=${timeframe}`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Network error');
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60 * 1000); // 1 min refresh
    return () => clearInterval(intervalId);
  }, [timeframe, market]);

  const formatTime = (ts) => {
    const d = new Date(Number(ts));
    const local = d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const utc = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
    }) + ' UTC';
    
    return { local, utc };
  };

  const formatNumber = (num, minDecimals = 2, maxDecimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals
    });
  };

  return (
    <div className="dashboard-container">
      <div className="header">
        <div className="title-group">
          <h1>
            <Activity className="text-accent" size={28} color="#58a6ff" />
            Bitcoin Infinity Tracker
          </h1>
          <p>Multi-Market Analysis: {market.toUpperCase()} | {timeframe.toUpperCase()}</p>
        </div>
        
        <div className="header-actions">
          {/* Market Toggle */}
          <div className="toggle-group shadow-sm">
            <button 
              className={`toggle-btn ${market === 'spot' ? 'active' : ''}`}
              onClick={() => setMarket('spot')}
            >
              Spot
            </button>
            <button 
              className={`toggle-btn ${market === 'futures' ? 'active' : ''}`}
              onClick={() => setMarket('futures')}
            >
              Futures
            </button>
          </div>

          {/* Timeframe Select */}
          <div className="toggle-group shadow-sm">
            {['4h', '8h', '12h', 'daily', 'weekly', 'monthly'].map(tf => (
              <button 
                key={tf}
                className={`toggle-btn ${timeframe === tf ? 'active' : ''}`}
                onClick={() => setTimeframe(tf)}
                style={{ textTransform: 'capitalize' }}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="live-badge">
            <div className="pulse"></div>
            Live
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            Fetching {market} {timeframe} matrix...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time / Date</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>SAR-1</th>
                  <th>SAR-2</th>
                  <th>SAR-3</th>
                  <th className="close-group-cell first">Close Value</th>
                  <th className="close-group-cell">Pts</th>
                  <th className="close-group-cell">%</th>
                  <th className="close-group-cell">Vol (k)</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={row.timestamp}>
                    <td>
                      <div className="time-cell">
                        <div className="time-local">
                          <Clock size={12} opacity={0.5} />
                          {formatTime(row.timestamp).local}
                        </div>
                        <div className="time-utc">
                          {formatTime(row.timestamp).utc}
                        </div>
                      </div>
                    </td>
                    <td>{formatNumber(row.open)}</td>
                    <td>{formatNumber(row.high)}</td>
                    <td>{formatNumber(row.low)}</td>
                    
                    <td className="col-sar">{formatNumber(row.sar1)}</td>
                    <td className="col-sar">{row.sar2 === 0 ? '-' : formatNumber(row.sar2)}</td>
                    <td className="col-sar">{row.sar3 === 0 ? '-' : formatNumber(row.sar3)}</td>
                    
                    <td className="close-group-cell first" style={{ fontWeight: 600 }}>
                      {formatNumber(row.close)}
                    </td>
                    <td className={`close-group-cell ${row.closePts > 0 ? 'val-positive' : row.closePts < 0 ? 'val-negative' : 'val-neutral'}`}>
                      {row.closePts > 0 ? '+' : ''}{formatNumber(row.closePts)}
                    </td>
                    <td className={`close-group-cell ${row.closePct > 0 ? 'val-positive' : row.closePct < 0 ? 'val-negative' : 'val-neutral'}`}>
                      {row.closePct > 0 ? '+' : ''}{formatNumber(row.closePct)}%
                    </td>
                    <td className="close-group-cell text-muted">
                      {formatNumber(row.volume / 1000, 1, 1)}k
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan="11" className="empty-state">
                      No data found for this matrix segment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
