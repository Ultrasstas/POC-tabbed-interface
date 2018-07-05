import React from 'react';
import { Header, Label, Button, Segment } from 'semantic-ui-react';

import './OrganizationTab.scss';

export default function OrganizationTab(props) {
  const { organization } = props;
  const {
    id,
    name,
    summary,
    labels,
  } = organization;

  return (
    <Segment padded>
      <Header as="h2">{ name }</Header>
      <p>{ summary }</p>
      <Label.Group>
        {
          labels.map(label => <Label key={label}>{ label }</Label>)
        }
      </Label.Group>
      <div className="floated-btn-container">
        <Button
          negative
          floated="right"
          onClick={() => props.onDelete('organizations', id)}
        >Delete
        </Button>
      </div>
    </Segment>
  );
}
