module.exports = {
	devServer: {
		host: '0.0.0.0',
		port: 8081,
		historyApiFallback: true,
		allowedHosts: 'all',
		client: {
			overlay: false
		}
	}
}