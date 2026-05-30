# Before running
- Replace `mqtt.gateway` to your physical meshtastic node id in `config.yaml`
- Replace default channel name if your default channel differs from `MediumFast`.
Just replace all occurences of `MediumFast` in config file to your new channel name.

### Optionally
- Change `mqtt.encryption` to `false` if you have mqtt encryption disabled in your meshtastic app.
- You may want to change bot's appearance in the mesh (id, long and short names), you can do so with config options `meshtastic.node.id`, `meshtastic.node.name.short`, `meshtastic.node.name.long`

# How to run
```shell
# you should clone the repo first
cd example
sudo docker compose up -d
```

# The setup
After starting the docker compose there will be 4 services running:
| App | Service | Port | Description |
| --- | ------- | ---- | ----------- |
| Mosquitto | mqtt-server | 1883 | Local MQTT broker you should connect your meshtastic node to |
| Sophisticated | bot-node | 9067 | BOT and metrics exporter |
| Prometheus | prometheus | 9090 | Metrics collection and querying |
| Grafana | grafana | 3000 | Visualization of your data |

Grafana is automatically provisioned with prometheus datasource and default dashboard
So you should go to http://127.0.0.1:3000 and check it out. It may take a while until first metrics show up.

Default Grafana credentials are `admin:admin`.
