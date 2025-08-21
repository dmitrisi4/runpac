
// <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" xml:space="preserve" width="64px" height="64px" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .st0{fill:#77B3D4;} .st1{opacity:0.2;} .st2{fill:#231F20;} .st3{fill:#E0995E;} .st4{fill:#FFFFFF;} .st5{fill:#E0E0D1;} .st6{fill:#4F5D73;} </style> <g id="Layer_1"> <g> <circle className="st0" cx="32" cy="32" r="32"></circle> </g> <g className="st1"> <path className="st2" d="M48,14H16c-2.2,0-4,1.8-4,4v5.5V50c0,2.2,1.8,4,4,4h32c2.2,0,4-1.8,4-4V23.5V18C52,15.8,50.2,14,48,14z"></path> </g> <g> <path className="st3" d="M48,12H16c-2.2,0-4,1.8-4,4v5.5V48c0,2.2,1.8,4,4,4h32c2.2,0,4-1.8,4-4V21.5V16C52,13.8,50.2,12,48,12z"></path> </g> <g className="st1"> <rect x="16" y="18" className="st2" width="32" height="32"></rect> </g> <g> <rect x="16" y="16" className="st4" width="32" height="32"></rect> </g> <g> <rect x="22" y="24" className="st5" width="20" height="2"></rect> </g> <g> <rect x="22" y="28" className="st5" width="20" height="2"></rect> </g> <g> <rect x="22" y="32" className="st5" width="20" height="2"></rect> </g> <g> <rect x="22" y="36" className="st5" width="20" height="2"></rect> </g> <g> <rect x="22" y="40" className="st5" width="20" height="2"></rect> </g> <g className="st1"> <path className="st2" d="M37,12H27h-3v3v1v1c0,1.7,1.3,3,3,3h10c1.7,0,3-1.3,3-3v-1v-1v-3H37z"></path> </g> <g> <path className="st6" d="M37,10H27h-3v3v1v1c0,1.7,1.3,3,3,3h10c1.7,0,3-1.3,3-3v-1v-1v-3H37z"></path> </g> </g> <g id="Layer_2"> </g> </g></svg>
const HistoryIcon = (props: any) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		xmlSpace="preserve"
		viewBox="0 0 64 64"
		width={64}
		height={64}
		{...props}
	>
		<g id="SVGRepo_iconCarrier">
			<style>{".st1{opacity:.2}.st2{fill:#231f20}.st5{fill:#e0e0d1}"}</style>
			<g id="Layer_1">
				<circle
					cx={32}
					cy={32}
					r={32}
					style={{
						fill: "#77b3d4",
					}}
				/>
				<g className="st1">
					<path
						d="M48 14H16c-2.2 0-4 1.8-4 4v32c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z"
						className="st2"
					/>
				</g>
				<path
					d="M48 12H16c-2.2 0-4 1.8-4 4v32c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4V16c0-2.2-1.8-4-4-4z"
					style={{
						fill: "#e0995e",
					}}
				/>
				<g className="st1">
					<path d="M16 18h32v32H16z" className="st2" />
				</g>
				<path
					d="M16 16h32v32H16z"
					style={{
						fill: "#fff",
					}}
				/>
				<path
					d="M22 24h20v2H22zM22 28h20v2H22zM22 32h20v2H22zM22 36h20v2H22zM22 40h20v2H22z"
					className="st5"
				/>
				<g className="st1">
					<path
						d="M37 12H24v5c0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3v-5h-3z"
						className="st2"
					/>
				</g>
				<path
					d="M37 10H24v5c0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3v-5h-3z"
					style={{
						fill: "#4f5d73",
					}}
				/>
			</g>
		</g>
	</svg>
)
export default HistoryIcon
