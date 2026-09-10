// CivicLens Frontend Client Logic
const API_BASE = window.location.origin;
const THEME_STORAGE_KEY = 'civiclens_theme';

function initializeTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, theme);

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    const isDark = theme === 'dark';
    toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    toggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    toggle.setAttribute('aria-pressed', String(isDark));
  }
}

document.addEventListener('DOMContentLoaded', initializeTheme);

const DEFAULT_MAP_CENTER = { lat: 28.5355, lng: 77.391 };
let googleMap;
let googleMapMarker;
let googleMapGeocoder;

document.addEventListener('DOMContentLoaded', initializeLocationPicker);

async function initializeLocationPicker() {
  const locationInput = document.getElementById('locationName');
  const locateButton = document.getElementById('useMyLocation');
  if (!locationInput || !locateButton) return;

  locationInput.addEventListener('change', () => geocodeLocationName(locationInput.value));
  locateButton.addEventListener('click', useCurrentLocation);

  try {
    const response = await fetch(`${API_BASE}/api/config/maps`);
    const { googleMapsApiKey } = response.ok ? await response.json() : {};
    if (!googleMapsApiKey) throw new Error('Google Maps API key is not configured');
    await loadGoogleMapsApi(googleMapsApiKey);
    createGoogleMap();
  } catch (_) {
    showMapFallback();
  }
}

function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Maps could not be loaded'));
    document.head.appendChild(script);
  });
}

function createGoogleMap() {
  const mapElement = document.getElementById('locationMap');
  const input = document.getElementById('locationName');
  if (!mapElement || !input) return;

  mapElement.innerHTML = '';
  googleMap = new google.maps.Map(mapElement, { center: DEFAULT_MAP_CENTER, zoom: 14, mapTypeControl: false, streetViewControl: false });
  googleMapGeocoder = new google.maps.Geocoder();
  googleMap.addListener('click', (event) => setMapLocation(event.latLng.lat(), event.latLng.lng()));

  const autocomplete = new google.maps.places.Autocomplete(input, { fields: ['formatted_address', 'geometry', 'name'] });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    input.value = place.formatted_address || place.name || input.value;
    setMapLocation(place.geometry.location.lat(), place.geometry.location.lng(), input.value, false);
  });
}

function setMapLocation(latitude, longitude, locationName, reverseGeocode = true) {
  document.getElementById('latitude').value = Number(latitude).toFixed(6);
  document.getElementById('longitude').value = Number(longitude).toFixed(6);
  const position = { lat: Number(latitude), lng: Number(longitude) };

  if (googleMap) {
    googleMap.panTo(position);
    googleMap.setZoom(Math.max(googleMap.getZoom() || 0, 16));
    if (!googleMapMarker) googleMapMarker = new google.maps.Marker({ map: googleMap });
    googleMapMarker.setPosition(position);
  }

  if (locationName) document.getElementById('locationName').value = locationName;
  if (reverseGeocode && googleMapGeocoder) {
    googleMapGeocoder.geocode({ location: position }, (results, status) => {
      if (status === 'OK' && results?.[0]) document.getElementById('locationName').value = results[0].formatted_address;
    });
  }
}

function geocodeLocationName(locationName) {
  if (!locationName || !googleMapGeocoder) return;
  googleMapGeocoder.geocode({ address: locationName }, (results, status) => {
    if (status === 'OK' && results?.[0]?.geometry?.location) {
      const point = results[0].geometry.location;
      setMapLocation(point.lat(), point.lng(), results[0].formatted_address, false);
    }
  });
}

function useCurrentLocation() {
  if (!navigator.geolocation) return alert('Your browser does not support location services.');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => setMapLocation(coords.latitude, coords.longitude),
    () => alert('Location access was not granted. Please search or drop a pin on the map.'),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function showMapFallback() {
  const mapElement = document.getElementById('locationMap');
  const help = document.getElementById('locationHelp');
  if (mapElement) mapElement.innerHTML = '<div class="location-map-empty">Google Maps needs a configured API key. You can still enter a location and coordinates will be resolved when Maps is enabled.</div>';
  if (help) help.textContent = 'Set GOOGLE_MAPS_API_KEY to enable address search, pin dropping, and current-location selection.';
}

// Preset Scenarios for Rapid Hackathon Demonstrations
const DEMO_SCENARIOS = {
  garbage: {
    description: 'Garbage has been overflowing near our apartment for three days and there is a severe bad smell attracting stray dogs.',
    locationName: 'Sector 15 Main Market',
    latitude: 28.5355,
    longitude: 77.3910,
    affectedPeople: 150,
  },
  pothole: {
    description: 'Massive deep crater and damaged asphalt right outside the school entrance gate. Two-wheelers have skidded twice today.',
    locationName: 'Greenwood School Zone',
    latitude: 28.5480,
    longitude: 77.4020,
    affectedPeople: 450,
  },
  light: {
    description: 'Three consecutive streetlights are broken plunging the main hospital approach lane into total darkness for four nights.',
    locationName: 'Government Hospital Area',
    latitude: 28.5420,
    longitude: 77.3980,
    affectedPeople: 300,
  },
  water: {
    description: 'Main potable water supply pipe fractured and burst, flooding the entire street with clean drinking water while homes have zero pressure.',
    locationName: 'Residential Block A',
    latitude: 28.5310,
    longitude: 77.3940,
    affectedPeople: 250,
  },
  drain: {
    description: 'Storm drain completely clogged with plastic waste; black wastewater backing up across the pedestrian sidewalk.',
    locationName: 'Central Bus Stand',
    latitude: 28.5290,
    longitude: 77.3850,
    affectedPeople: 500,
  },
};

function fillScenario(key) {
  const scenario = DEMO_SCENARIOS[key];
  if (!scenario) return;

  document.getElementById('description').value = scenario.description;
  document.getElementById('locationName').value = scenario.locationName;
  document.getElementById('latitude').value = scenario.latitude;
  document.getElementById('longitude').value = scenario.longitude;
  document.getElementById('affectedPeople').value = scenario.affectedPeople;
  setMapLocation(scenario.latitude, scenario.longitude, scenario.locationName, false);
}

function handleFileSelected(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('filePreview');
  if (file) {
    preview.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  } else {
    preview.textContent = '';
  }
}

// Handle Citizen Complaint Submission
async function handleComplaintSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> <span>Analyzing Complaint...</span>`;

  try {
    const form = document.getElementById('complaintForm');
    const formData = new FormData(form);

    const response = await fetch(`${API_BASE}/api/complaints`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to submit complaint');
    }

    const data = await response.json();
    renderAnalysisResult(data);
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }
}

// Render AI Intelligence Analysis on Citizen Page
function renderAnalysisResult(data) {
  document.getElementById('resultPlaceholder').style.display = 'none';
  document.getElementById('resultContent').style.display = 'block';

  document.getElementById('resCategory').textContent = data.category;
  
  // Severity Badge
  const sevEl = document.getElementById('resSeverity');
  sevEl.textContent = data.severity;
  sevEl.className = 'badge-card-value';
  if (data.severity === 'Critical') sevEl.style.color = 'var(--danger)';
  else if (data.severity === 'High') sevEl.style.color = '#c53929';
  else if (data.severity === 'Medium') sevEl.style.color = '#b06000';
  else sevEl.style.color = 'var(--accent)';

  document.getElementById('resDepartment').textContent = data.department;
  document.getElementById('resDuplicates').textContent = `${data.duplicateCount} nearby`;

  // Priority Score & Gauge
  document.getElementById('resPriorityScore').textContent = `${data.priorityScore}/100`;
  const bar = document.getElementById('resPriorityBar');
  bar.style.width = '0%';
  setTimeout(() => {
    bar.style.width = `${Math.min(100, data.priorityScore)}%`;
  }, 100);

  // Summary & Rationale
  document.getElementById('resSummary').textContent = data.summary;
  document.getElementById('resReason').textContent = data.reason;
  document.getElementById('resComplaintId').textContent = data.complaintId;

  // Status Badge
  const statusBadge = document.getElementById('complaintStatusBadge');
  statusBadge.style.display = 'inline-block';
  statusBadge.textContent = data.status || 'OPEN';

  // Smooth scroll into view on mobile
  document.getElementById('analysisCard').scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// Municipal Dashboard Authentication & Controls
// ==========================================

function fillAdminCredentials() {
  const userField = document.getElementById('username');
  const passField = document.getElementById('password');
  if (userField && passField) {
    userField.value = 'admin@city.gov';
    passField.value = 'civicadmin2026';
  }
}

async function checkAuthStatus() {
  const token = localStorage.getItem('civiclens_auth_token');
  const userJson = localStorage.getItem('civiclens_user');

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const authNav = document.getElementById('authenticatedUserNav');

  if (token && loginView && dashboardView) {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    if (authNav) authNav.style.display = 'flex';

    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        const nameEl = document.getElementById('officerNameDisplay');
        const bottomEmailEl = document.getElementById('officerEmailBottom');
        if (nameEl) nameEl.textContent = u.name || u.username;
        if (bottomEmailEl) bottomEmailEl.textContent = u.username || 'admin@city.gov';
      } catch (e) {}
    }

    await loadDashboardData({ showLoadingOverlay: true });
  } else if (loginView && dashboardView) {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
    if (authNav) authNav.style.display = 'none';
    setDashboardLoading(false);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const loginBtn = document.getElementById('loginBtn');
  const loginErr = document.getElementById('loginError');
  loginErr.style.display = 'none';

  const originalHtml = loginBtn.innerHTML;
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner"></span> <span>Verifying credentials...</span>`;

  try {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Invalid credentials');
    }

    const data = await res.json();
    localStorage.setItem('civiclens_auth_token', data.token);
    localStorage.setItem('civiclens_user', JSON.stringify(data.user));

    await checkAuthStatus();
  } catch (error) {
    loginErr.textContent = error.message;
    loginErr.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHtml;
  }
}

function handleLogout() {
  // Clear every piece of municipal session state before returning to the login view.
  localStorage.removeItem('civiclens_auth_token');
  localStorage.removeItem('civiclens_user');
  allDashboardComplaints = [];

  const filterInput = document.getElementById('complaintFilterInput');
  if (filterInput) filterInput.value = '';

  checkAuthStatus();

  // Make the completed logout state obvious and ready for another officer to sign in.
  const passwordField = document.getElementById('password');
  if (passwordField) passwordField.value = '';
  document.getElementById('username')?.focus();
}

// ==========================================
// Municipal Dashboard Analytics Functions
// ==========================================
let allDashboardComplaints = [];
let dashboardRefreshInProgress = false;
const complaintQueueState = {
  page: 1,
  pageSize: 10,
};

function setDashboardLoading(isLoading) {
  const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
  const dashboardView = document.getElementById('dashboardView');
  if (loadingOverlay) loadingOverlay.hidden = !isLoading;
  if (dashboardView) dashboardView.setAttribute('aria-busy', String(isLoading));
}

function switchDashboardTab(tabName) {
  const analyticsPanel = document.getElementById('analyticsPanel');
  const actionsPanel = document.getElementById('actionsPanel');
  const analyticsTab = document.getElementById('analyticsTab');
  const actionsTab = document.getElementById('actionsTab');
  if (!analyticsPanel || !actionsPanel || !analyticsTab || !actionsTab) return;

  const showActions = tabName === 'actions';
  analyticsPanel.hidden = showActions;
  actionsPanel.hidden = !showActions;
  analyticsTab.classList.toggle('is-active', !showActions);
  actionsTab.classList.toggle('is-active', showActions);
  analyticsTab.setAttribute('aria-selected', String(!showActions));
  actionsTab.setAttribute('aria-selected', String(showActions));

  if (showActions) document.getElementById('complaintFilterInput')?.focus();
}

async function loadDashboardData({ showLoadingOverlay = false } = {}) {
  if (dashboardRefreshInProgress) return;

  dashboardRefreshInProgress = true;
  if (showLoadingOverlay) setDashboardLoading(true);
  const refreshButton = document.getElementById('refreshDashboardBtn');
  const refreshStatus = document.getElementById('dashboardRefreshStatus');
  const originalButtonText = refreshButton?.innerHTML;

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.innerHTML = '<span class="spinner"></span> Refreshing...';
  }
  if (refreshStatus) refreshStatus.textContent = ' · Refreshing data...';

  const requestOptions = { cache: 'no-store' };
  const requests = [
    fetch(`${API_BASE}/api/dashboard/summary`, requestOptions),
    fetch(`${API_BASE}/api/dashboard/categories`, requestOptions),
    fetch(`${API_BASE}/api/dashboard/severity`, requestOptions),
    fetch(`${API_BASE}/api/dashboard/departments`, requestOptions),
    fetch(`${API_BASE}/api/dashboard/hotspots?limit=8`, requestOptions),
    fetch(`${API_BASE}/api/complaints?limit=100`, requestOptions),
  ];

  try {
    // A single unavailable metric should not prevent the rest of the dashboard from updating.
    const results = await Promise.allSettled(requests);
    const renderers = [
      renderKPIs,
      renderCategories,
      renderSeverity,
      renderDepartments,
      renderHotspots,
      (complaints) => {
        allDashboardComplaints = complaints;
        populateComplaintCategoryFilter();
        populateComplaintStatusFilter();
        renderComplaintsTable();
      },
    ];

    let failedRequests = 0;
    await Promise.all(
      results.map(async (result, index) => {
        if (result.status !== 'fulfilled' || !result.value.ok) {
          failedRequests += 1;
          if (result.status === 'fulfilled') {
            console.error(`Dashboard request ${index + 1} failed with HTTP ${result.value.status}`);
          } else {
            console.error(`Dashboard request ${index + 1} failed:`, result.reason);
          }
          return;
        }
        renderers[index](await result.value.json());
      }),
    );

    if (refreshStatus) {
      refreshStatus.textContent = failedRequests
        ? ` · Updated with ${failedRequests} unavailable data source${failedRequests === 1 ? '' : 's'}.`
        : ` · Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }
  } catch (err) {
    console.error('Error loading dashboard metrics:', err);
    if (refreshStatus) refreshStatus.textContent = ' · Unable to refresh dashboard data.';
  } finally {
    dashboardRefreshInProgress = false;
    if (showLoadingOverlay) setDashboardLoading(false);
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.innerHTML = originalButtonText || '🔄 Refresh';
    }
  }
}

function renderKPIs(summary) {
  document.getElementById('kpiTotal').textContent = summary.totalComplaints;
  document.getElementById('kpiHighPriority').textContent = summary.highPriorityCount;
  document.getElementById('kpiCritical').textContent = summary.criticalCount;
  document.getElementById('kpiAvgPriority').textContent = `${summary.avgPriorityScore}/100`;
  document.getElementById('kpiTopCategory').textContent = summary.topCategory || 'N/A';
}

function renderCategories(categories) {
  const container = document.getElementById('categoryProgressContainer');
  if (!categories || categories.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--gray-mid);">No complaints data found.</div>`;
    return;
  }

  container.innerHTML = categories
    .map(
      (c) => `
    <div class="progress-list-item">
      <div class="progress-header">
        <span>${c.category} (${c.count})</span>
        <span style="color: var(--primary); font-weight: 700;">${c.percentage}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${c.percentage}%;"></div>
      </div>
    </div>
  `,
    )
    .join('');
}

function renderSeverity(severityList) {
  const container = document.getElementById('severityContainer');
  if (!severityList || severityList.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--gray-mid);">No severity data available.</div>`;
    return;
  }

  const badgeMap = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  };

  container.innerHTML = severityList
    .map(
      (s) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #f1f3f4;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="badge ${badgeMap[s.severity] || 'badge-low'}">${s.severity}</span>
        <span style="font-weight: 600; font-size: 0.9rem;">${s.count} complaints</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--gray-mid);">
        Avg Priority: <strong>${s.avgPriority}</strong>
      </div>
    </div>
  `,
    )
    .join('');
}

function renderHotspots(hotspots) {
  const tbody = document.getElementById('hotspotsTableBody');
  if (!hotspots || hotspots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--gray-mid);">No recurring hotspots detected yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = hotspots
    .map(
      (h) => `
    <tr>
      <td><strong>${h.locationName}</strong></td>
      <td><span style="font-size: 0.85rem; color: var(--primary);">${h.category}</span></td>
      <td><span class="badge badge-high">${h.complaintCount} issues</span></td>
      <td><strong>${h.avgPriority}</strong>/100</td>
    </tr>
  `,
    )
    .join('');
}

function renderDepartments(departments) {
  const tbody = document.getElementById('departmentsTableBody');
  if (!departments || departments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--gray-mid);">No department workload data.</td></tr>`;
    return;
  }

  tbody.innerHTML = departments
    .map(
      (d) => `
    <tr>
      <td><strong>${d.department}</strong></td>
      <td>${d.totalAssigned}</td>
      <td><span class="badge badge-critical">${d.urgentIssues}</span></td>
      <td><strong>${d.avgPriority}</strong></td>
    </tr>
  `,
    )
    .join('');
}

function renderComplaintsTable() {
  const tbody = document.getElementById('complaintsTableBody');
  if (!tbody) return;

  const complaints = getFilteredAndSortedComplaints();
  const totalPages = Math.max(1, Math.ceil(complaints.length / complaintQueueState.pageSize));
  complaintQueueState.page = Math.min(complaintQueueState.page, totalPages);
  const startIndex = (complaintQueueState.page - 1) * complaintQueueState.pageSize;
  const pageComplaints = complaints.slice(startIndex, startIndex + complaintQueueState.pageSize);

  if (complaints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--gray-mid);">No complaints currently in queue.</td></tr>`;
    renderComplaintPagination(0, 0, 0);
    return;
  }

  const badgeMap = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  };

  tbody.innerHTML = pageComplaints
    .map((c) => {
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today';
      const scoreColor = c.priority_score >= 75 ? 'var(--danger)' : c.priority_score >= 50 ? '#b06000' : 'var(--accent)';
      const imageUrl = getComplaintImageUrl(c.image_url, c.complaint_id);
      const imageCell = imageUrl
        ? `<a class="complaint-photo-link" href="${imageUrl}" target="_blank" rel="noopener noreferrer" aria-label="View photo for complaint ${escapeHtml(c.complaint_id)}">
             <img class="complaint-photo-thumbnail" src="${imageUrl}" alt="Citizen-uploaded photo for complaint ${escapeHtml(c.complaint_id)}" loading="lazy">
           </a>`
        : '<span class="complaint-photo-empty">No photo</span>';
      return `
      <tr>
        <td><code>${c.complaint_id}</code></td>
        <td><strong>${c.category}</strong></td>
        <td><span class="badge ${badgeMap[c.severity] || 'badge-low'}">${c.severity}</span></td>
        <td>${c.location_name}</td>
        <td><strong style="color: ${scoreColor}; font-size: 0.95rem;">${c.priority_score}</strong>/100</td>
        <td>${c.duplicate_count > 0 ? `<span style="color:#c53929; font-weight:700;">${c.duplicate_count}</span>` : '0'}</td>
        <td><span class="badge ${getStatusBadgeClass(c.status)}">${formatComplaintStatus(c.status)}</span></td>
        <td>
          <select class="complaint-status-select" data-complaint-id="${escapeHtml(c.complaint_id)}" onchange="updateComplaintStatus(this)" aria-label="Update status for complaint ${escapeHtml(c.complaint_id)}">
            ${['OPEN', 'IN_PROGRESS', 'CLOSED'].map((status) => `<option value="${status}" ${status === (c.status || 'OPEN') ? 'selected' : ''}>${formatComplaintStatus(status)}</option>`).join('')}
          </select>
        </td>
        <td>${imageCell}</td>
        <td style="font-size: 0.8rem; color: var(--gray-mid);">${dateStr}</td>
      </tr>
    `;
    })
    .join('');

  renderComplaintPagination(complaints.length, totalPages, startIndex);
}

function formatComplaintStatus(status) {
  return String(status || 'OPEN').replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusBadgeClass(status) {
  if (status === 'CLOSED') return 'badge-low';
  if (status === 'IN_PROGRESS') return 'badge-medium';
  return 'badge-high';
}

async function updateComplaintStatus(select) {
  const complaintId = select.dataset.complaintId;
  const status = select.value;
  const token = localStorage.getItem('civiclens_auth_token');
  if (!complaintId || !token) return;

  const previousStatus = allDashboardComplaints.find((complaint) => complaint.complaint_id === complaintId)?.status || 'OPEN';
  select.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/complaints/${encodeURIComponent(complaintId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to update complaint status');
    }

    const complaint = allDashboardComplaints.find((item) => item.complaint_id === complaintId);
    if (complaint) complaint.status = status;
    populateComplaintStatusFilter();
    renderComplaintsTable();
  } catch (error) {
    select.value = previousStatus;
    alert(error.message);
  } finally {
    select.disabled = false;
  }
}

function getComplaintImageUrl(imageUrl, complaintId) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  try {
    const url = new URL(imageUrl, window.location.origin);
    const isLocalUpload = url.origin === window.location.origin && url.pathname.startsWith('/uploads/');
    if (isLocalUpload) return url.href;
    if (url.protocol === 'https:' && complaintId) {
      return `${API_BASE}/api/complaints/${encodeURIComponent(complaintId)}/image`;
    }
  } catch (_) {
    // Invalid URLs are treated as records without an available image.
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function filterComplaintsTable() {
  complaintQueueState.page = 1;
  renderComplaintsTable();
}

function sortComplaintsTable() {
  complaintQueueState.page = 1;
  renderComplaintsTable();
}

function sortComplaintsByCreatedAt() {
  const sortSelect = document.getElementById('complaintSortSelect');
  if (!sortSelect) return;

  sortSelect.value = sortSelect.value === 'newest' ? 'oldest' : 'newest';
  complaintQueueState.page = 1;
  renderComplaintsTable();
}

function getFilteredAndSortedComplaints() {
  const query = document.getElementById('complaintFilterInput')?.value.trim().toLowerCase() || '';
  const category = document.getElementById('complaintCategoryFilter')?.value || '';
  const severity = document.getElementById('complaintSeverityFilter')?.value || '';
  const status = document.getElementById('complaintStatusFilter')?.value || '';
  const sort = document.getElementById('complaintSortSelect')?.value || 'newest';
  updateCreatedAtSortIndicator(sort);

  const filtered = allDashboardComplaints.filter(
    (c) =>
      (!query ||
        c.complaint_id.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.location_name.toLowerCase().includes(query) ||
        c.severity.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query))) &&
      (!category || c.category === category) &&
      (!severity || c.severity === severity) &&
      (!status || (c.status || 'OPEN') === status),
  );

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'priority-asc':
        return a.priority_score - b.priority_score;
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'location':
        return (a.location_name || '').localeCompare(b.location_name || '');
      case 'priority-desc':
      default:
        return b.priority_score - a.priority_score;
    }
  });
}

function updateCreatedAtSortIndicator(sort) {
  const header = document.getElementById('createdAtHeader');
  const button = document.getElementById('createdAtSortButton');
  if (!header || !button) return;

  if (sort === 'newest') {
    header.setAttribute('aria-sort', 'descending');
    button.innerHTML = 'Created <span aria-hidden="true">↓</span>';
  } else if (sort === 'oldest') {
    header.setAttribute('aria-sort', 'ascending');
    button.innerHTML = 'Created <span aria-hidden="true">↑</span>';
  } else {
    header.setAttribute('aria-sort', 'none');
    button.innerHTML = 'Created <span aria-hidden="true">↕</span>';
  }
}

function populateComplaintCategoryFilter() {
  const select = document.getElementById('complaintCategoryFilter');
  if (!select) return;

  const selectedCategory = select.value;
  const categories = [...new Set(allDashboardComplaints.map((c) => c.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All categories</option>' + categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');
  select.value = categories.includes(selectedCategory) ? selectedCategory : '';
}

function populateComplaintStatusFilter() {
  const select = document.getElementById('complaintStatusFilter');
  if (!select) return;

  const selectedStatus = select.value;
  const statuses = [...new Set(allDashboardComplaints.map((c) => c.status || 'OPEN'))].sort();
  select.innerHTML = '<option value="">All statuses</option>' + statuses
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(formatComplaintStatus(status))}</option>`)
    .join('');
  select.value = statuses.includes(selectedStatus) ? selectedStatus : '';
}

function setComplaintQueuePage(page) {
  complaintQueueState.page = Math.max(1, page);
  renderComplaintsTable();
}

function setComplaintQueuePageSize(pageSize) {
  complaintQueueState.pageSize = Number(pageSize);
  complaintQueueState.page = 1;
  renderComplaintsTable();
}

function renderComplaintPagination(total, totalPages, startIndex) {
  const pagination = document.getElementById('complaintPagination');
  if (!pagination) return;

  if (!total) {
    pagination.innerHTML = '';
    return;
  }

  const endIndex = Math.min(startIndex + complaintQueueState.pageSize, total);
  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `<button type="button" class="queue-page-button ${page === complaintQueueState.page ? 'is-active' : ''}" onclick="setComplaintQueuePage(${page})" aria-label="Page ${page}" ${page === complaintQueueState.page ? 'aria-current="page"' : ''}>${page}</button>`;
  }).join('');

  pagination.innerHTML = `
    <span class="queue-results-count">Showing ${startIndex + 1}–${endIndex} of ${total}</span>
    <div class="queue-pagination-actions">
      <label>Rows <select onchange="setComplaintQueuePageSize(this.value)" aria-label="Rows per page">
        ${[10, 25, 50].map((size) => `<option value="${size}" ${size === complaintQueueState.pageSize ? 'selected' : ''}>${size}</option>`).join('')}
      </select></label>
      <button type="button" class="queue-page-button" onclick="setComplaintQueuePage(${complaintQueueState.page - 1})" ${complaintQueueState.page === 1 ? 'disabled' : ''}>Previous</button>
      <span class="queue-page-numbers">${pageButtons}</span>
      <button type="button" class="queue-page-button" onclick="setComplaintQueuePage(${complaintQueueState.page + 1})" ${complaintQueueState.page === totalPages ? 'disabled' : ''}>Next</button>
    </div>`;
}
